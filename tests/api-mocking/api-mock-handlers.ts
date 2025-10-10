import { http, HttpResponse } from 'msw';
import { createMockStreamResponse } from '../helpers';
import { TEST_PROMPTS } from '../prompts/routes';

export const handlers = [
  http.post('*/serving-endpoints/chat/completions', async (req) => {
    const body = await req.request.clone().json();
    if ((body as any)?.stream) {
      return createMockStreamResponse(
        TEST_PROMPTS.SKY.OUTPUT_STREAM.responseSSE,
      );
    } else {
      return HttpResponse.json(TEST_PROMPTS.SKY.OUTPUT_TITLE.response);
    }
  }),
];
