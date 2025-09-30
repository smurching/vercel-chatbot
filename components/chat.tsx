'use client';

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

  // Cursor-based stream resumption to prevent duplicate content
  const cursorRef = useRef(0);
  const retryingRef = useRef(false);
  const retryCountRef = useRef(0);
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
      api: '/api/chat',
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
        // Include cursor parameter to prevent duplicate chunks
        const cursor = cursorRef.current;
        console.log(`[Chat] Preparing reconnect with cursor=${cursor}`);
        return {
          api: `/api/chat/${id}/stream?cursor=${cursor}`,
          credentials: 'include',
        };
      },
    }),
    onData: (dataPart) => {
      console.log('[Chat onData] Received data part:', dataPart);
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
      if (dataPart.type === 'data-usage') {
        setUsage(dataPart.data);
      }
      // Track cursor position for each chunk received
      // if (dataPart.type === 'text-delta' || dataPart.type === 'tool-call-delta' || dataPart.type === 'tool-result') {
      cursorRef.current++;
      // }
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

  useAutoResume({
    autoResume,
    initialMessages,
    resumeStream,
    setMessages,
  });

  // Cursor-based retry logic for handling connection breaks
  useEffect(() => {
    // Only retry when actively streaming and an error occurs
    if (status === 'error' && !retryingRef.current && retryCountRef.current < MAX_RETRIES) {
      retryingRef.current = true;
      const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, retryCountRef.current);

      console.log(
        `[Chat] Connection error detected, retrying from cursor ${cursorRef.current} ` +
        `(attempt ${retryCountRef.current + 1}/${MAX_RETRIES}) after ${retryDelay}ms`
      );

      const timer = setTimeout(() => {
        try {
          // Use AI SDK's resumeStream() which will call prepareReconnectToStreamRequest
          // with our cursor parameter to prevent duplicate chunks
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

    // Reset cursor when starting new stream
    if (status === 'streaming') {
      cursorRef.current = 0;
      retryCountRef.current = 0;
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
          messages={messages}
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
              messages={messages}
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
