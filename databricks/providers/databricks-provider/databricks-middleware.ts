import type { LanguageModelV2Middleware } from '@ai-sdk/provider';
import { getDatabricksLanguageModelTransformStream } from './stream-transformers/databricks-stream-transformer';
import { DATABRICKS_TOOL_CALL_ID } from './stream-transformers/databricks-tool-calling';
import { extractReasoningMiddleware } from 'ai';

const databricksStreamMiddleware: LanguageModelV2Middleware = {
  transformParams: async ({ params }) => {
    return {
      ...params,
      // Filter out the DATABRICKS_TOOL_CALL_ID tool
      tools: params.tools?.filter(
        (tool) => tool.name !== DATABRICKS_TOOL_CALL_ID,
      ),
    };
  },
  wrapGenerate: async ({ doGenerate }) => doGenerate(),
  wrapStream: async ({ doStream }) => {
    const { stream, ...rest } = await doStream();
    const transformStream = getDatabricksLanguageModelTransformStream();

    return {
      stream: stream.pipeThrough(transformStream),
      ...rest,
    };
  },
};

export const getDatabricksMiddleware = () => [
  extractReasoningMiddleware({ tagName: 'think' }),
  databricksStreamMiddleware,
];
