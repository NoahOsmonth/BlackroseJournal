import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type {
  NormalizedInferenceEvent,
  ProviderProtocol,
} from '../../../../../packages/ai-control-plane-contracts/src';
import { executeProviderInference } from '../index';

const parseFixture = async (
  protocol: ProviderProtocol,
  body: unknown,
): Promise<NormalizedInferenceEvent[]> => {
  const events: NormalizedInferenceEvent[] = [];
  const execution = executeProviderInference({
    provider: { protocol, baseUrl: 'https://provider.example/v1' },
    modelId: 'model-one',
    secret: 'secret',
    request: { purpose: 'chat', messages: [{ role: 'user', content: 'Hi' }], stream: false },
    fetchFn: async () => Response.json(body),
  });
  for await (const event of execution) events.push(event);
  return events;
};

describe('provider non-stream response parsing', () => {
  it('normalizes OpenAI Chat Completions text, tool calls, usage, and finish reason', async () => {
    const events = await parseFixture('openai-chat-completions', {
      choices: [{
        message: {
          content: 'Hello',
          tool_calls: [{
            id: 'call-1',
            type: 'function',
            function: { name: 'remember', arguments: '{"fact":"rose"}' },
          }],
        },
        finish_reason: 'tool_calls',
      }],
      usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
    });

    assert.deepEqual(events, [
      { type: 'text_delta', text: 'Hello' },
      { type: 'tool_call_delta', index: 0, id: 'call-1', name: 'remember', argumentsDelta: '{"fact":"rose"}' },
      { type: 'usage', inputTokens: 10, outputTokens: 4, totalTokens: 14 },
      { type: 'completion', reason: 'tool_calls' },
    ]);
  });

  it('normalizes OpenAI Responses output items and incomplete completion', async () => {
    const events = await parseFixture('openai-responses', {
      status: 'incomplete',
      incomplete_details: { reason: 'max_output_tokens' },
      output: [
        { type: 'message', content: [{ type: 'output_text', text: 'Partial' }] },
        { type: 'function_call', call_id: 'call-2', name: 'save', arguments: '{"ok":true}' },
      ],
      usage: { input_tokens: 7, output_tokens: 3, total_tokens: 10 },
    });

    assert.deepEqual(events, [
      { type: 'text_delta', text: 'Partial' },
      { type: 'tool_call_delta', index: 0, id: 'call-2', name: 'save', argumentsDelta: '{"ok":true}' },
      { type: 'usage', inputTokens: 7, outputTokens: 3, totalTokens: 10 },
      { type: 'completion', reason: 'length' },
    ]);
  });

  it('normalizes Anthropic content blocks and token accounting', async () => {
    const events = await parseFixture('anthropic-messages', {
      content: [
        { type: 'text', text: 'Checking' },
        { type: 'tool_use', id: 'tool-1', name: 'lookup', input: { day: 'today' } },
      ],
      stop_reason: 'tool_use',
      usage: { input_tokens: 8, output_tokens: 5 },
    });

    assert.deepEqual(events, [
      { type: 'text_delta', text: 'Checking' },
      { type: 'tool_call_delta', index: 1, id: 'tool-1', name: 'lookup', argumentsDelta: '{"day":"today"}' },
      { type: 'usage', inputTokens: 8, outputTokens: 5, totalTokens: 13 },
      { type: 'completion', reason: 'tool_calls' },
    ]);
  });

  it('normalizes Gemini parts, safety finish reason, and token accounting', async () => {
    const events = await parseFixture('gemini-generate-content', {
      candidates: [{
        finishReason: 'SAFETY',
        content: { parts: [
          { text: 'Cannot answer' },
          { functionCall: { name: 'flag', args: { reason: 'unsafe' } } },
        ] },
      }],
      usageMetadata: { promptTokenCount: 6, candidatesTokenCount: 2, totalTokenCount: 8 },
    });

    assert.deepEqual(events, [
      { type: 'text_delta', text: 'Cannot answer' },
      { type: 'tool_call_delta', index: 1, name: 'flag', argumentsDelta: '{"reason":"unsafe"}' },
      { type: 'usage', inputTokens: 6, outputTokens: 2, totalTokens: 8 },
      { type: 'completion', reason: 'content_filter' },
    ]);
  });
});
