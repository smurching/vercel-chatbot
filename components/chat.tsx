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
import { useStreamTiming } from '@/hooks/use-stream-timing';
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

  // Track reconnection attempts for onError handling
  const reconnectAttemptsRef = useRef(0);
  const isReconnectingRef = useRef(false);
  const MAX_ERROR_RECONNECT_ATTEMPTS = 5;

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
      // Reset reconnect attempts on successful completion
      reconnectAttemptsRef.current = 0;
    },
    onError: (error) => {
      console.log('[Chat onError] Error occurred:', error);

      // Check if this is a network error that might be due to proxy timeout
      const errorMessage = error?.message || '';
      const isNetworkError =
        errorMessage.includes('ERR_INCOMPLETE_CHUNKED_ENCODING') ||
        errorMessage.includes('network') ||
        errorMessage.includes('fetch') ||
        error?.name === 'TypeError';

      if (isNetworkError && !isReconnectingRef.current) {
        // Check if we've exceeded max reconnection attempts
        if (reconnectAttemptsRef.current >= MAX_ERROR_RECONNECT_ATTEMPTS) {
          console.warn(
            `[Chat onError] Max reconnection attempts (${MAX_ERROR_RECONNECT_ATTEMPTS}) reached`,
          );
          toast({
            type: 'error',
            description: 'Connection lost. Please try again.',
          });
          return;
        }

        isReconnectingRef.current = true;
        reconnectAttemptsRef.current += 1;

        console.log(
          `[Chat onError] Network error detected, attempting to resume stream (attempt ${reconnectAttemptsRef.current}/${MAX_ERROR_RECONNECT_ATTEMPTS})`,
        );

        // Calculate exponential backoff delay
        const backoffDelay = Math.min(
          1000 * Math.pow(2, reconnectAttemptsRef.current - 1),
          10000,
        );

        setTimeout(() => {
          try {
            console.log('[Chat onError] Calling resumeStream()...');
            resumeStream();
          } catch (resumeError) {
            console.error('[Chat onError] Error calling resumeStream:', resumeError);
            toast({
              type: 'error',
              description: 'Failed to resume stream. Please try again.',
            });
          } finally {
            isReconnectingRef.current = false;
          }
        }, backoffDelay);
      } else if (error instanceof ChatSDKError) {
        toast({
          type: 'error',
          description: error.message,
        });
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

  // Reset reconnect attempts when starting a new message
  useEffect(() => {
    if (status === 'submitted') {
      reconnectAttemptsRef.current = 0;
      isReconnectingRef.current = false;
    }
  }, [status]);

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

  // Track and log streaming timing metrics
  useStreamTiming({
    status,
    messages,
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
