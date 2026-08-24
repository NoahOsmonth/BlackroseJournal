import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type {
  NormalizedInferenceRequest,
  ProviderProtocol,
} from '../../../../../packages/ai-control-plane-contracts/src';
import { executeProviderInference } from '../index';

const collect = async (events: AsyncIterable<unknown>): Promise<unknown[]> => {
  const result: unknown[] = [];
  for await (const event of events) result.push(event);
  return result;
};

const executeAndCapture = async (
  protocol: ProviderProtocol,
  request: NormalizedInferenceRequest,
): Promise<{ url: string; headers: Headers; body: Record<string, unknown> }> => {
  let captured: { url: string; headers: Headers; body: Record<string, unknown> } | undefined;
  await collect(executeProviderInference({
    provider: { protocol, baseUrl: 'https://provider.example/v1' },
    modelId: 'model/one',
    secret: 'secret-value',
    request,
    fetchFn: async (input, init) => {
      captured = {
        url: String(input),
        headers: new Headers(init?.headers),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      };
      return Response.json(protocol === 'anthropic-messages'
        ? { content: [], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 0 } }
        : protocol === 'gemini-generate-content'
          ? { candidates: [{ finishReason: 'STOP', content: { parts: [] } }], usageMetadata: {} }
          : protocol === 'openai-responses'
            ? { output: [], status: 'completed', usage: {} }
            : { choices: [{ message: {}, finish_reason: 'stop' }], usage: {} });
    },
  }));
  assert.ok(captured);
  return captured;
};

describe('provider request translation', () => {
  it('translates normalized input to OpenAI Chat Completions wire format', async () => {
    const captured = await executeAndCapture('openai-chat-completions', {
      purpose: 'chat',
      systemInstruction: 'Be concise.',
      messages: [{ role: 'user', content: [
        { type: 'text', text: 'Look' },
        { type: 'image', url: 'https://images.example/rose.jpg', mediaType: 'image/jpeg' },
      ] }],
      tools: [{ name: 'remember', description: 'Remember a fact', inputSchema: { type: 'object' } }],
      toolChoice: { name: 'remember' },
      responseFormat: { type: 'json_schema', name: 'memory', schema: { type: 'object' }, strict: true },
      temperature: 0.2,
      topP: 0.8,
      maxOutputTokens: 321,
      stream: false,
    });

    assert.equal(captured.url, 'https://provider.example/v1/chat/completions');
    assert.equal(captured.headers.get('authorization'), 'Bearer secret-value');
    assert.deepEqual(captured.body, {
      model: 'model/one',
      messages: [
        { role: 'system', content: 'Be concise.' },
        { role: 'user', content: [
          { type: 'text', text: 'Look' },
          { type: 'image_url', image_url: { url: 'https://images.example/rose.jpg' } },
        ] },
      ],
      tools: [{ type: 'function', function: {
        name: 'remember', description: 'Remember a fact', parameters: { type: 'object' },
      } }],
      tool_choice: { type: 'function', function: { name: 'remember' } },
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'memory', schema: { type: 'object' }, strict: true },
      },
      temperature: 0.2,
      top_p: 0.8,
      max_tokens: 321,
      stream: false,
    });
  });

  it('translates normalized input to OpenAI Responses wire format', async () => {
    const captured = await executeAndCapture('openai-responses', {
      purpose: 'flash',
      systemInstruction: 'Extract facts.',
      messages: [{ role: 'user', content: 'A fact' }],
      tools: [{ name: 'save', description: 'Save it', inputSchema: { type: 'object' } }],
      toolChoice: 'required',
      responseFormat: { type: 'json_object' },
      maxOutputTokens: 99,
      stream: false,
    });

    assert.equal(captured.url, 'https://provider.example/v1/responses');
    assert.deepEqual(captured.body, {
      model: 'model/one',
      instructions: 'Extract facts.',
      input: [{ role: 'user', content: [{ type: 'input_text', text: 'A fact' }] }],
      tools: [{ type: 'function', name: 'save', description: 'Save it', parameters: { type: 'object' } }],
      tool_choice: 'required',
      text: { format: { type: 'json_object' } },
      max_output_tokens: 99,
      stream: false,
    });
  });

  it('translates normalized input to Anthropic Messages wire format', async () => {
    const captured = await executeAndCapture('anthropic-messages', {
      purpose: 'chat',
      systemInstruction: 'Be kind.',
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Calling a tool' },
        { role: 'tool', name: 'lookup', toolCallId: 'call-1', content: 'result' },
      ],
      tools: [{ name: 'lookup', description: 'Look up', inputSchema: { type: 'object' } }],
      toolChoice: { name: 'lookup' },
      responseFormat: { type: 'json_schema', name: 'lookup_result', schema: { type: 'object' } },
      maxOutputTokens: 200,
      stream: false,
    });

    assert.equal(captured.url, 'https://provider.example/v1/messages');
    assert.equal(captured.headers.get('x-api-key'), 'secret-value');
    assert.equal(captured.headers.get('anthropic-version'), '2023-06-01');
    assert.deepEqual(captured.body, {
      model: 'model/one',
      system: 'Be kind.',
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
        { role: 'assistant', content: [{ type: 'text', text: 'Calling a tool' }] },
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'call-1', content: 'result' }] },
      ],
      tools: [{ name: 'lookup', description: 'Look up', input_schema: { type: 'object' } }],
      tool_choice: { type: 'tool', name: 'lookup' },
      output_config: { format: { type: 'json_schema', schema: { type: 'object' } } },
      max_tokens: 200,
      stream: false,
    });
  });

  it('translates normalized input to Gemini GenerateContent wire format', async () => {
    const captured = await executeAndCapture('gemini-generate-content', {
      purpose: 'flash',
      systemInstruction: 'Return JSON.',
      messages: [{ role: 'user', content: [
        { type: 'text', text: 'Inspect' },
        { type: 'image', url: 'https://images.example/rose.jpg', mediaType: 'image/jpeg' },
      ] }],
      tools: [{ name: 'store', description: 'Store', inputSchema: { type: 'object' } }],
      toolChoice: { name: 'store' },
      responseFormat: { type: 'json_schema', name: 'fact', schema: { type: 'object' } },
      temperature: 0.1,
      topP: 0.7,
      maxOutputTokens: 80,
      stream: false,
    });

    assert.equal(captured.url, 'https://provider.example/v1/models/model%2Fone:generateContent');
    assert.equal(captured.headers.get('x-goog-api-key'), 'secret-value');
    assert.deepEqual(captured.body, {
      systemInstruction: { parts: [{ text: 'Return JSON.' }] },
      contents: [{ role: 'user', parts: [
        { text: 'Inspect' },
        { fileData: { fileUri: 'https://images.example/rose.jpg', mimeType: 'image/jpeg' } },
      ] }],
      tools: [{ functionDeclarations: [{
        name: 'store', description: 'Store', parameters: { type: 'object' },
      }] }],
      toolConfig: { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: ['store'] } },
      generationConfig: {
        temperature: 0.1,
        topP: 0.7,
        maxOutputTokens: 80,
        responseMimeType: 'application/json',
        responseJsonSchema: { type: 'object' },
      },
    });
  });
});
