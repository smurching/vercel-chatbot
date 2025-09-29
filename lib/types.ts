import { z } from 'zod';
import type { InferUITool, LanguageModelUsage, UIMessage } from 'ai';

import type { ArtifactKind } from '@/components/artifact';
import type { Suggestion } from './db/schema';
import type {
  DATABRICKS_TOOL_CALL_ID,
  DATABRICKS_TOOL_DEFINITION,
} from '../databricks/chunk-transformers/databricks-tool-calling';

export type DataPart = { type: 'append-message'; message: string };

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

export type ChatTools = {
  [K in typeof DATABRICKS_TOOL_CALL_ID]: InferUITool<
    typeof DATABRICKS_TOOL_DEFINITION
  >;
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
  usage: LanguageModelUsage;
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;

export interface Attachment {
  name: string;
  url: string;
  contentType: string;
}
