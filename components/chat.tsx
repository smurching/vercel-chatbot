'use client';

import { DefaultChatTransport, type LanguageModelUsage } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useEffect, useRef, useState } from 'react';
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
import { useStreamReconnect } from '@/hooks/use-stream-reconnect';
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

  // Client-side retry state
  const retryAttemptsRef = useRef(0);
  const isRetryingRef = useRef(false);
  const lastMessageContentRef = useRef<string>('');
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const MAX_RETRY_ATTEMPTS = 5;
  const INACTIVITY_TIMEOUT_MS = 15000; // 15 seconds of no new content

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
        return {
          api: `/api/chat/${id}/stream`,
          credentials: 'include',
        };
      },
    }),
    onData: (dataPart) => {
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
      if (dataPart.type === 'data-usage') {
        setUsage(dataPart.data);
      }
    },
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
      // Clear retry state on successful completion
      retryAttemptsRef.current = 0;
      isRetryingRef.current = false;
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    },
    onError: (error) => {
      console.log('[Chat onError] Error occurred:', error);

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

  // Monitor for streaming inactivity and retry if connection drops
  useEffect(() => {
    // Clear any existing timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }

    // Reset state when not streaming
    if (status === 'ready' || status === 'submitted') {
      retryAttemptsRef.current = 0;
      isRetryingRef.current = false;
      lastMessageContentRef.current = '';
      return;
    }

    // Only monitor during streaming or error state (after network timeout)
    if (status !== 'streaming' && status !== 'error') {
      return;
    }

    // Get the latest assistant message content
    const lastAssistantMessage = messages
      .slice()
      .reverse()
      .find(m => m.role === 'assistant');

    if (!lastAssistantMessage) return;

    const currentContent = lastAssistantMessage.parts
      .map(p => (p.type === 'text' ? p.text : ''))
      .join('');

    // Check if we have new content since last check
    const hasNewContent = currentContent !== lastMessageContentRef.current;
    lastMessageContentRef.current = currentContent;

    if (hasNewContent) {
      // Reset retry attempts when we receive new content
      console.log('[Retry] Received new content, resetting retry attempts');
      retryAttemptsRef.current = 0;
    }

    // Don't retry if status is error and we haven't detected genuine inactivity yet
    // This prevents immediate retry on network error
    if (status === 'error' && retryAttemptsRef.current === 0 && !hasNewContent) {
      console.log('[Retry] Initial error state detected, starting inactivity monitoring');
    }

    // Set up inactivity timer
    inactivityTimerRef.current = setTimeout(() => {
      // Check if we've exceeded max retry attempts
      if (retryAttemptsRef.current >= MAX_RETRY_ATTEMPTS) {
        console.warn(`[Retry] Max retry attempts (${MAX_RETRY_ATTEMPTS}) reached`);
        toast({
          type: 'error',
          description: 'Connection lost. Please refresh to see the complete response.',
        });
        return;
      }

      // Don't retry if already retrying
      if (isRetryingRef.current) {
        console.log('[Retry] Already retrying, skipping');
        return;
      }

      isRetryingRef.current = true;
      retryAttemptsRef.current += 1;

      console.log(
        `[Retry] No new content for ${INACTIVITY_TIMEOUT_MS}ms, attempting retry ${retryAttemptsRef.current}/${MAX_RETRY_ATTEMPTS}`
      );

      // Calculate exponential backoff delay
      const backoffDelay = Math.min(
        1000 * Math.pow(2, retryAttemptsRef.current - 1),
        10000
      );

      setTimeout(() => {
        try {
          console.log('[Retry] Calling resumeStream()...');
          resumeStream();
        } catch (error) {
          console.error('[Retry] Error calling resumeStream:', error);
        } finally {
          isRetryingRef.current = false;
        }
      }, backoffDelay);
    }, INACTIVITY_TIMEOUT_MS);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    };
  }, [status, messages, resumeStream]);

  useAutoResume({
    autoResume,
    initialMessages,
    resumeStream,
    setMessages,
  });

  // Automatically reconnect stream if it times out (e.g., due to 60s proxy timeout)
  useStreamReconnect({
    status,
    resumeStream,
    messages,
    inactivityTimeout: 12000, // 12s to detect 10s proxy timeout
    maxReconnectAttempts: 5,
  });

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
