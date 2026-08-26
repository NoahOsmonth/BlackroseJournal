import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type {
  NormalizedInferenceEvent,
  ProviderProtocol,
} from '../../../../../packages/ai-control-plane-contracts/src';
import { executeProviderInference, ProviderAdapterError } from '../index';

const streamedResponse = (source: string): Response => {
  const bytes = new TextEncoder().encode(source);
  const split = Math.floor(bytes.length / 3);
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes.slice(0, split));
      controller.enqueue(bytes.slice(split, split * 2));
      controller.enqueue(bytes.slice(split * 2));
      controller.close();
    },
  }), { headers: { 'content-type': 'text/event-stream' } });
};

const parseFixture = async (
  protocol: ProviderProtocol,
  source: string,
): Promise<NormalizedInferenceEvent[]> => {
  const result: NormalizedInferenceEvent[] = [];
  const events = executeProviderInference({
    provider: { protocol, baseUrl: 'https://provider.example/v1' },
    modelId: 'model-one',
    secret: 'secret',
    request: { purpose: 'chat', messages: [{ role: 'user', content: 'Hi' }], stream: true },
    fetchFn: async () => streamedResponse(source),
  });
  for await (const event of events) result.push(event);
  return result;
};

describe('provider streaming response parsing', () => {
  it('rejects HTTP-200 provider error frames for every protocol', async () => {
    const fixtures: [ProviderProtocol, unknown][] = [
      ['openai-chat-completions', { error: { message: 'secret upstream detail' } }],
      ['openai-responses', { type: 'response.failed', response: { error: { message: 'secret upstream detail' } } }],
      ['anthropic-messages', { type: 'error', error: { message: 'secret upstream detail' } }],
      ['gemini-generate-content', { error: { message: 'secret upstream detail' } }],
    ];
    for (const [protocol, frame] of fixtures) {
      await assert.rejects(
        () => parseFixture(protocol, `data: ${JSON.stringify(frame)}\n\n`),
        (error: unknown) => error instanceof ProviderAdapterError
          && !error.message.includes('secret upstream detail'),
      );
    }
  });

  it('normalizes OpenAI Chat Completions SSE split across transport chunks', async () => {
    const events = await parseFixture('openai-chat-completions', [
      ': keepalive',
      '',
      `data: ${JSON.stringify({ choices: [{ delta: { content: 'Hel' } }] })}`,
      '',
      `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call-1', function: { name: 'save', arguments: '{"x"' } }] } }] })}`,
      '',
      `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: ':1}' } }] }, finish_reason: 'tool_calls' }] })}`,
      '',
      `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 9, completion_tokens: 3, total_tokens: 12 } })}`,
      '',
      'data: [DONE]',
      '',
    ].join('\n'));

    assert.deepEqual(events, [
      { type: 'text_delta', text: 'Hel' },
      { type: 'tool_call_delta', index: 0, id: 'call-1', name: 'save', argumentsDelta: '{"x"' },
      { type: 'tool_call_delta', index: 0, argumentsDelta: ':1}' },
      { type: 'usage', inputTokens: 9, outputTokens: 3, totalTokens: 12 },
      { type: 'completion', reason: 'tool_calls' },
    ]);
  });

  it('normalizes OpenAI Responses typed SSE events', async () => {
    const events = await parseFixture('openai-responses', [
      'event: response.output_text.delta',
      `data: ${JSON.stringify({ type: 'response.output_text.delta', delta: 'Hi' })}`,
      '',
      'event: response.output_item.added',
      `data: ${JSON.stringify({ type: 'response.output_item.added', output_index: 1, item: { type: 'function_call', call_id: 'call-2', name: 'remember' } })}`,
      '',
      'event: response.function_call_arguments.delta',
      `data: ${JSON.stringify({ type: 'response.function_call_arguments.delta', output_index: 1, delta: '{"fact":true}' })}`,
      '',
      'event: response.completed',
      `data: ${JSON.stringify({ type: 'response.completed', response: { status: 'completed', usage: { input_tokens: 5, output_tokens: 4, total_tokens: 9 } } })}`,
      '',
    ].join('\n'));

    assert.deepEqual(events, [
      { type: 'text_delta', text: 'Hi' },
      { type: 'tool_call_delta', index: 1, id: 'call-2', name: 'remember', argumentsDelta: '' },
      { type: 'tool_call_delta', index: 1, argumentsDelta: '{"fact":true}' },
      { type: 'usage', inputTokens: 5, outputTokens: 4, totalTokens: 9 },
      { type: 'completion', reason: 'stop' },
    ]);
  });

  it('normalizes Anthropic Messages SSE while combining usage frames', async () => {
    const events = await parseFixture('anthropic-messages', [
      `data: ${JSON.stringify({ type: 'message_start', message: { usage: { input_tokens: 11, output_tokens: 0 } } })}`,
      '',
      `data: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hello' } })}`,
      '',
      `data: ${JSON.stringify({ type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'tool-1', name: 'lookup' } })}`,
      '',
      `data: ${JSON.stringify({ type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"day":"today"}' } })}`,
      '',
      `data: ${JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 6 } })}`,
      '',
      `data: ${JSON.stringify({ type: 'message_stop' })}`,
      '',
    ].join('\n'));

    assert.deepEqual(events, [
      { type: 'text_delta', text: 'Hello' },
      { type: 'tool_call_delta', index: 1, id: 'tool-1', name: 'lookup', argumentsDelta: '' },
      { type: 'tool_call_delta', index: 1, argumentsDelta: '{"day":"today"}' },
      { type: 'usage', inputTokens: 11, outputTokens: 6, totalTokens: 17 },
      { type: 'completion', reason: 'tool_calls' },
    ]);
  });

  it('normalizes Gemini streaming GenerateContent SSE frames', async () => {
    const events = await parseFixture('gemini-generate-content', [
      `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Hello' }] } }] })}`,
      '',
      `data: ${JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ functionCall: { name: 'save', args: { value: 1 } } }] } }], usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 2, totalTokenCount: 6 } })}`,
      '',
    ].join('\n'));

    assert.deepEqual(events, [
      { type: 'text_delta', text: 'Hello' },
      { type: 'tool_call_delta', index: 0, name: 'save', argumentsDelta: '{"value":1}' },
      { type: 'usage', inputTokens: 4, outputTokens: 2, totalTokens: 6 },
      { type: 'completion', reason: 'stop' },
    ]);
  });
});
