import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type {
  NormalizedInferenceRequest,
  ProviderProtocol,
} from '../../../../../packages/ai-control-plane-contracts/src';
import { executeProviderInference } from '../index';

const request: NormalizedInferenceRequest = {
  purpose: 'chat',
  messages: [
    {
      role: 'assistant',
      content: 'Let me check.',
      toolCalls: [{ id: 'call-1', name: 'get_clock', arguments: '{"timezone":"Asia/Manila"}' }],
    },
    { role: 'tool', name: 'get_clock', toolCallId: 'call-1', content: '{"time":"noon"}' },
  ],
  stream: false,
};

const responseBody = (protocol: ProviderProtocol): unknown => {
  if (protocol === 'anthropic-messages') {
    return { content: [], stop_reason: 'end_turn', usage: {} };
  }
  if (protocol === 'gemini-generate-content') {
    return { candidates: [{ content: { parts: [] }, finishReason: 'STOP' }] };
  }
  if (protocol === 'openai-responses') return { output: [], status: 'completed' };
  return { choices: [{ message: {}, finish_reason: 'stop' }] };
};

const captureBody = async (protocol: ProviderProtocol): Promise<Record<string, unknown>> => {
  let body: Record<string, unknown> | undefined;
  const events = executeProviderInference({
    provider: { protocol, baseUrl: 'https://provider.example/v1' },
    modelId: 'model-one',
    secret: 'secret',
    request,
    fetchFn: async (_url, init) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json(responseBody(protocol));
    },
  });
  for await (const _event of events) { /* consume */ }
  assert.ok(body);
  return body;
};

describe('assistant tool-call history translation', () => {
  it('preserves tool calls and results for OpenAI Chat Completions', async () => {
    const body = await captureBody('openai-chat-completions');
    assert.deepEqual(body.messages, [
      {
        role: 'assistant',
        content: 'Let me check.',
        tool_calls: [{
          id: 'call-1',
          type: 'function',
          function: { name: 'get_clock', arguments: '{"timezone":"Asia/Manila"}' },
        }],
      },
      { role: 'tool', name: 'get_clock', tool_call_id: 'call-1', content: '{"time":"noon"}' },
    ]);
  });

  it('preserves tool calls and results as OpenAI Responses input items', async () => {
    const body = await captureBody('openai-responses');
    assert.deepEqual(body.input, [
      { role: 'assistant', content: [{ type: 'output_text', text: 'Let me check.' }] },
      {
        type: 'function_call',
        call_id: 'call-1',
        name: 'get_clock',
        arguments: '{"timezone":"Asia/Manila"}',
      },
      { type: 'function_call_output', call_id: 'call-1', output: '{"time":"noon"}' },
    ]);
  });

  it('preserves tool calls and results as Anthropic content blocks', async () => {
    const body = await captureBody('anthropic-messages');
    assert.deepEqual(body.messages, [
      { role: 'assistant', content: [
        { type: 'text', text: 'Let me check.' },
        {
          type: 'tool_use',
          id: 'call-1',
          name: 'get_clock',
          input: { timezone: 'Asia/Manila' },
        },
      ] },
      { role: 'user', content: [{
        type: 'tool_result',
        tool_use_id: 'call-1',
        content: '{"time":"noon"}',
      }] },
    ]);
  });

  it('preserves tool calls and results as Gemini function parts', async () => {
    const body = await captureBody('gemini-generate-content');
    assert.deepEqual(body.contents, [
      { role: 'model', parts: [
        { text: 'Let me check.' },
        { functionCall: { name: 'get_clock', args: { timezone: 'Asia/Manila' } } },
      ] },
      { role: 'user', parts: [{
        functionResponse: { name: 'get_clock', response: { time: 'noon' } },
      }] },
    ]);
  });
});
