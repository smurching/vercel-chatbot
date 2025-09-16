import {
  LanguageModelV1,
  LanguageModelV1FinishReason,
  LanguageModelV1StreamPart,
  InvalidResponseDataError,
} from '@ai-sdk/provider';
import {
  safeParseJSON,
} from '@ai-sdk/provider-utils';
import { z } from 'zod';

// Databricks response schema
const databricksResponseSchema = z.object({
  model: z.string(),
  object: z.string(),
  output: z.array(
    z.object({
      type: z.string(),
      id: z.string(),
      role: z.string(),
      content: z.array(
        z.object({
          type: z.string(),
          text: z.string(),
        })
      ),
    })
  ),
  id: z.string(),
});

type DatabricksResponse = z.infer<typeof databricksResponseSchema>;

export interface DatabricksLanguageModelConfig {
  provider: string;
  baseURL: string;
  headers: () => Record<string, string>;
  fetch?: typeof fetch;
}

export class DatabricksLanguageModel implements LanguageModelV1 {
  readonly specificationVersion = 'v2';
  readonly defaultObjectGenerationMode = 'json';
  readonly supportsImageUrls = false;

  readonly modelId: string;
  readonly provider: string;
  readonly baseURL: string;
  readonly headers: () => Record<string, string>;
  readonly fetch?: typeof fetch;

  constructor(
    modelId: string,
    config: DatabricksLanguageModelConfig
  ) {
    this.modelId = modelId;
    this.provider = config.provider;
    this.baseURL = config.baseURL;
    this.headers = config.headers;
    this.fetch = config.fetch;
  }

  async doGenerate(options: Parameters<LanguageModelV1['doGenerate']>[0]): Promise<Awaited<ReturnType<LanguageModelV1['doGenerate']>>> {
    const { mode, prompt, maxTokens, temperature, topP, frequencyPenalty, presencePenalty, stopSequences, seed, responseFormat, abortSignal } = options;

    // Convert messages for Databricks agent format
    const input = prompt.map((msg) => {
      if (msg.role === 'system') {
        return { role: 'system', content: msg.content };
      } else if (msg.role === 'user') {
        const content = msg.content
          .filter(part => part.type === 'text')
          .map(part => part.text)
          .join(' ');
        return { role: 'user', content };
      } else if (msg.role === 'assistant') {
        const content = msg.content
          .filter(part => part.type === 'text')
          .map(part => part.text)
          .join(' ');
        return { role: 'assistant', content };
      }
      return null;
    }).filter(Boolean);

    const requestBody = {
      input,
      max_output_tokens: maxTokens,
      temperature,
      top_p: topP,
      stream: false,
    };

    const response = await (this.fetch ?? fetch)(this.baseURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.headers(),
      },
      body: JSON.stringify(requestBody),
      signal: abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Databricks API error details:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        requestBody: JSON.stringify(requestBody, null, 2)
      });
      throw new Error(`Databricks API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const responseText = await response.text();
    const parsedResponse = safeParseJSON({ text: responseText });

    if (!parsedResponse.success) {
      throw new InvalidResponseDataError({
        data: responseText,
        message: `Invalid JSON response from Databricks`,
      });
    }

    // Try to parse as Databricks format first
    const databricksResult = databricksResponseSchema.safeParse(parsedResponse.value);

    if (databricksResult.success) {
      // Handle Databricks response format
      const data = databricksResult.data;
      const output = data.output[0];
      const text = output.content.map(c => c.text).join('');

      return {
        text,
        usage: {
          promptTokens: 0,
          completionTokens: 0,
        },
        finishReason: 'stop' as LanguageModelV1FinishReason,
        rawCall: {
          rawPrompt: input,
          rawSettings: requestBody,
        },
        warnings: [],
      };
    }

    // Try OpenAI format as fallback
    const openAIResponse = parsedResponse.value as any;
    if (openAIResponse.choices && openAIResponse.choices[0]) {
      const choice = openAIResponse.choices[0];
      const text = choice.message?.content || '';

      return {
        text,
        usage: {
          promptTokens: openAIResponse.usage?.prompt_tokens || 0,
          completionTokens: openAIResponse.usage?.completion_tokens || 0,
        },
        finishReason: (choice.finish_reason || 'stop') as LanguageModelV1FinishReason,
        rawCall: {
          rawPrompt: input,
          rawSettings: requestBody,
        },
        warnings: [],
      };
    }

    throw new InvalidResponseDataError({
      data: parsedResponse.value,
      message: `Unexpected response format from Databricks`,
    });
  }

  async doStream(options: Parameters<LanguageModelV1['doStream']>[0]): Promise<Awaited<ReturnType<LanguageModelV1['doStream']>>> {
    const { mode, prompt, maxTokens, temperature, topP, frequencyPenalty, presencePenalty, stopSequences, seed, abortSignal } = options;

    // Convert messages for Databricks agent format
    const input = prompt.map((msg) => {
      if (msg.role === 'system') {
        return { role: 'system', content: msg.content };
      } else if (msg.role === 'user') {
        const content = msg.content
          .filter(part => part.type === 'text')
          .map(part => part.text)
          .join(' ');
        return { role: 'user', content };
      } else if (msg.role === 'assistant') {
        const content = msg.content
          .filter(part => part.type === 'text')
          .map(part => part.text)
          .join(' ');
        return { role: 'assistant', content };
      }
      return null;
    }).filter(Boolean);

    const requestBody = {
      input,
      max_output_tokens: maxTokens,
      temperature,
      top_p: topP,
      stream: true,
    };

    const response = await (this.fetch ?? fetch)(this.baseURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.headers(),
      },
      body: JSON.stringify(requestBody),
      signal: abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Databricks API error details:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        requestBody: JSON.stringify(requestBody, null, 2)
      });
      throw new Error(`Databricks API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    return {
      stream: new ReadableStream<LanguageModelV1StreamPart>({
        async start(controller) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  if (data === '[DONE]') {
                    controller.enqueue({
                      type: 'finish',
                      finishReason: 'stop',
                      usage: {
                        promptTokens: 0,
                        completionTokens: 0,
                      },
                    });
                    break;
                  }

                  try {
                    const parsed = JSON.parse(data);

                    // Handle Databricks streaming format
                    if (parsed.output && parsed.output[0]) {
                      const output = parsed.output[0];
                      const text = output.content.map((c: any) => c.text).join('');
                      controller.enqueue({
                        type: 'text-delta',
                        textDelta: text,
                      });
                    }
                    // Handle OpenAI streaming format
                    else if (parsed.choices && parsed.choices[0]) {
                      const delta = parsed.choices[0].delta;
                      if (delta?.content) {
                        controller.enqueue({
                          type: 'text-delta',
                          textDelta: delta.content,
                        });
                      }
                    }
                  } catch (e) {
                    // Ignore parsing errors for individual chunks
                  }
                }
              }
            }
          } catch (error) {
            controller.error(error);
          } finally {
            controller.close();
          }
        },
      }),
      rawCall: {
        rawPrompt: messages,
        rawSettings: requestBody,
      },
      warnings: [],
    };
  }
}

export function createDatabricksProvider(config: {
  baseURL: string;
  apiKey: string;
  fetch?: typeof fetch;
}) {
  return (modelId: string) => {
    return new DatabricksLanguageModel(modelId, {
      provider: 'databricks',
      baseURL: config.baseURL,
      headers: () => ({
        'Authorization': `Bearer ${config.apiKey}`,
      }),
      fetch: config.fetch,
    });
  };
}