'use client';
import { useMemo } from 'react';
import { DefaultChatTransport, type LanguageModelUsage } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useEffect, useState, useRef } from 'react';
import { useSWRConfig } from 'swr';
import { ChatHeader } from '@/components/chat-header';
import { fetchWithErrorHandlers, generateUUID } from '@/lib/utils';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import type { VisibilityType } from './visibility-selector';
import { unstable_serialize } from 'swr/infinite';
import { getChatHistoryPaginationKey } from './sidebar-history';
import { toast } from './toast';
import type { AuthSession } from '@/databricks/auth/databricks-auth';
import { useSearchParams } from 'next/navigation';
import { useChatVisibility } from '@/hooks/use-chat-visibility';
import { useAutoResume } from '@/hooks/use-auto-resume';
import { ChatSDKError } from '@/lib/errors';
import type { Attachment, ChatMessage } from '@/lib/types';
import { useDataStream } from './data-stream-provider';

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType,
  isReadonly,
  session,
  autoResume,
  initialLastContext,
}: {
  id: string;
  initialMessages: ChatMessage[];
  initialChatModel: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  session: AuthSession;
  autoResume: boolean;
  initialLastContext?: LanguageModelUsage;
}) {
  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibilityType,
  });

  const { mutate } = useSWRConfig();
  const { setDataStream } = useDataStream();

  const [input, setInput] = useState<string>('');
  const [usage, setUsage] = useState<LanguageModelUsage | undefined>(
    initialLastContext,
  );

  // Client-side deduplication to prevent duplicate content
  const retryingRef = useRef(false);
  const retryCountRef = useRef(0);
  const seenChunkIds = useRef(new Set<string>());
  const maxContentLengthSeen = useRef(0);
  const MAX_RETRIES = 5;
  const INITIAL_RETRY_DELAY = 1000; // 1 second

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
  } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    experimental_throttle: 100,
    generateId: generateUUID,
    resume: true, // Enable automatic stream resumption
    transport: new DefaultChatTransport({
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest({ messages, id, body }) {
        return {
          body: {
            id,
            message: messages.at(-1),
            selectedChatModel: initialChatModel,
            selectedVisibilityType: visibilityType,
            ...body,
          },
        };
      },
      prepareReconnectToStreamRequest({ id }) {
        console.log(`[Chat] Preparing reconnect request`);
        return {
          api: `/api/chat/${id}/stream`,
          credentials: 'include',
        };
      },
    }),
    onData: (dataPart) => {
      console.log('[Chat onData] Received data part:', dataPart);

      // Track chunk IDs to detect duplicates
      if ('id' in dataPart && dataPart.id) {
        const chunkId = String(dataPart.id);
        if (seenChunkIds.current.has(chunkId)) {
          console.log(`[Chat] Skipping duplicate chunk ID: ${chunkId}`);
          return; // Skip this duplicate chunk
        }
        seenChunkIds.current.add(chunkId);
      }

      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
      if (dataPart.type === 'data-usage') {
        setUsage(dataPart.data);
      }
    },
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    },
    onError: (error) => {
      // console.log('[Chat onError] Error occurred:', error);

      if (error instanceof ChatSDKError) {
        toast({
          type: 'error',
          description: error.message,
        });
      } else {
        // Network error detected - trigger retry logic via effect below
        console.warn('[Chat onError] Network error during streaming');
      }
    },
  });

  const searchParams = useSearchParams();
  const query = searchParams.get('query');

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  useEffect(() => {
    if (query && !hasAppendedQuery) {
      sendMessage({
        role: 'user' as const,
        parts: [{ type: 'text', text: query }],
      });

      setHasAppendedQuery(true);
      window.history.replaceState({}, '', `/chat/${id}`);
    }
  }, [query, sendMessage, hasAppendedQuery, id]);

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);

  // useAutoResume({
  //   autoResume,
  //   initialMessages,
  //   resumeStream,
  //   setMessages,
  // });

  // Deduplicate messages by tracking content length and only showing new content
  // When resumeStream() replays, it starts from beginning, so we track max length
  // and only show content beyond what we've already displayed
  const deduplicatedMessages = useMemo(() => {
    if (messages.length === 0) return messages;

    return messages.map((message, idx) => {
      // Only process assistant messages
      if (message.role !== 'assistant') return message;

      // Only process the last message (the one being streamed)
      if (idx !== messages.length - 1) return message;

      // Calculate total text content length
      let currentTextLength = 0;
      const textParts: typeof message.parts = [];

      for (const part of message.parts) {
        if (part.type === 'text') {
          currentTextLength += part.text.length;
          textParts.push(part);
        }
      }

      // If content length hasn't grown beyond what we've seen, we're replaying
      // Keep only the parts that represent new content
      if (currentTextLength > maxContentLengthSeen.current) {
        console.log(`[Chat] Content grew from ${maxContentLengthSeen.current} to ${currentTextLength}`);
        maxContentLengthSeen.current = currentTextLength;
        return message;
      } else if (currentTextLength < maxContentLengthSeen.current) {
        // Content shrank - we're replaying from start. Build up to max length we've seen
        console.log(`[Chat] Replay detected (${currentTextLength} < ${maxContentLengthSeen.current}), truncating to max seen`);

        let accumulatedLength = 0;
        const truncatedParts: typeof message.parts = [];

        for (const part of message.parts) {
          if (part.type === 'text') {
            const remainingNeeded = maxContentLengthSeen.current - accumulatedLength;
            if (remainingNeeded > 0) {
              if (part.text.length <= remainingNeeded) {
                truncatedParts.push(part);
                accumulatedLength += part.text.length;
              } else {
                // Truncate this part
                truncatedParts.push({
                  ...part,
                  text: part.text.substring(0, remainingNeeded),
                });
                accumulatedLength += remainingNeeded;
                break;
              }
            }
          } else {
            // Keep non-text parts
            truncatedParts.push(part);
          }
        }

        return {
          ...message,
          parts: truncatedParts,
        };
      }

      return message;
    });
  }, [messages]);

  // Retry logic for handling connection breaks
  useEffect(() => {
    // Only retry when actively streaming and an error occurs
    if (status === 'error' && !retryingRef.current && retryCountRef.current < MAX_RETRIES) {
      retryingRef.current = true;
      const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, retryCountRef.current);

      console.log(
        `[Chat] Connection error detected, retrying ` +
        `(attempt ${retryCountRef.current + 1}/${MAX_RETRIES}) after ${retryDelay}ms`
      );

      const timer = setTimeout(() => {
        try {
          // Use AI SDK's resumeStream() to reconnect
          // The backend will replay all cached chunks, but we deduplicate on client
          resumeStream();

          // Reset retry counter on successful call (actual success determined by stream)
          retryCountRef.current = 0;
          retryingRef.current = false;
        } catch (error) {
          // console.error('[Chat] Retry failed:', error);
          retryCountRef.current++;
          retryingRef.current = false;

          if (retryCountRef.current >= MAX_RETRIES) {
            console.error('[Chat] Max retries reached, giving up');
            toast({
              type: 'error',
              description: 'Connection lost. Please refresh the page to see the complete response.',
            });
          }
        }
      }, retryDelay);

      return () => clearTimeout(timer);
    }

    // Reset state when starting new stream
    if (status === 'streaming') {
      retryCountRef.current = 0;
      maxContentLengthSeen.current = 0;
      seenChunkIds.current.clear();
    }
  }, [status, resumeStream]);

  return (
    <>
      <div className="overscroll-behavior-contain flex h-dvh min-w-0 touch-pan-y flex-col bg-background">
        <ChatHeader
          chatId={id}
          selectedVisibilityType={initialVisibilityType}
          isReadonly={isReadonly}
          session={session}
        />

        <Messages
          chatId={id}
          status={status}
          messages={deduplicatedMessages}
          setMessages={setMessages}
          regenerate={regenerate}
          isReadonly={isReadonly}
          selectedModelId={initialChatModel}
        />

        <div className="sticky bottom-0 z-1 mx-auto flex w-full max-w-4xl gap-2 border-t-0 bg-background px-2 pb-3 md:px-4 md:pb-4">
          {!isReadonly && (
            <MultimodalInput
              chatId={id}
              input={input}
              setInput={setInput}
              status={status}
              stop={stop}
              attachments={attachments}
              setAttachments={setAttachments}
              messages={deduplicatedMessages}
              setMessages={setMessages}
              sendMessage={sendMessage}
              selectedVisibilityType={visibilityType}
              selectedModelId={initialChatModel}
              usage={usage}
            />
          )}
        </div>
      </div>
    </>
  );
}
