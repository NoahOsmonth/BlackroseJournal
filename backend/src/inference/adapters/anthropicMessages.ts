import type { NormalizedInferenceEvent } from '../../../../packages/ai-control-plane-contracts/src';
import type { ProviderAdapter } from './types';
import {
  appendPath,
  asArray,
  asRecord,
  asString,
  blockContent,
  completionReason,
  put,
  readSseJson,
  usageEvent,
} from './shared';

export const anthropicMessagesAdapter: ProviderAdapter = {
  buildRequest(input) {
    const systemMessages = input.request.messages
      .filter((message) => message.role === 'system')
      .flatMap((message) => typeof message.content === 'string'
        ? [message.content]
        : message.content.filter((part) => part.type === 'text').map((part) => part.text));
    const system = [input.request.systemInstruction, ...systemMessages].filter(Boolean).join('\n\n');
    const body: Record<string, unknown> = {
      model: input.modelId,
      messages: input.request.messages
        .filter((message) => message.role !== 'system')
        .map((message) => message.role === 'tool'
          ? {
              role: 'user',
              content: [{
                type: 'tool_result',
                tool_use_id: message.toolCallId ?? message.name ?? '',
                content: typeof message.content === 'string'
                  ? message.content
                  : message.content.filter((part) => part.type === 'text').map((part) => part.text).join('\n'),
              }],
            }
          : {
              role: message.role,
              content: [
                ...blockContent(message.content),
                ...(message.toolCalls ?? []).map((call) => ({
                  type: 'tool_use',
                  id: call.id,
                  name: call.name,
                  input: asRecord(JSON.parse(call.arguments) as unknown),
                })),
              ],
            }),
      max_tokens: input.request.maxOutputTokens ?? 1024,
      stream: input.request.stream,
    };
    put(body, 'system', system || undefined);
    const choice = input.request.toolChoice;
    put(body, 'tools', choice === 'none' ? undefined : input.request.tools?.map((tool) => ({
      name: tool.name, description: tool.description, input_schema: tool.inputSchema,
    })));
    put(body, 'tool_choice', typeof choice === 'object'
      ? { type: 'tool', name: choice.name }
      : choice === 'required'
        ? { type: 'any' }
        : choice === 'auto'
          ? { type: 'auto' }
          : undefined);
    const format = input.request.responseFormat;
    put(body, 'output_config', format?.type === 'json_schema'
      ? { format: { type: 'json_schema', schema: format.schema } }
      : undefined);
    put(body, 'temperature', input.request.temperature);
    put(body, 'top_p', input.request.topP);
    return {
      url: appendPath(input.provider.baseUrl, 'messages'),
      headers: { 'x-api-key': input.secret, 'anthropic-version': '2023-06-01' },
      body,
    };
  },
  parseNonStream(value) {
    const root = asRecord(value);
    const events: NormalizedInferenceEvent[] = [];
    for (const [index, raw] of asArray(root.content).entries()) {
      const part = asRecord(raw);
      const text = asString(part.text);
      if (part.type === 'text' && text) events.push({ type: 'text_delta' as const, text });
      if (part.type === 'tool_use') {
        events.push({
          type: 'tool_call_delta' as const,
          index,
          id: asString(part.id),
          name: asString(part.name),
          argumentsDelta: JSON.stringify(part.input ?? {}),
        });
      }
    }
    const usage = asRecord(root.usage);
    if (Object.keys(usage).length > 0) {
      events.push(usageEvent(usage.input_tokens, usage.output_tokens));
    }
    events.push(completionReason(root.stop_reason));
    return events;
  },
  async *parseStream(response) {
    let inputTokens = 0;
    let outputTokens = 0;
    let stopReason: unknown;
    for await (const event of readSseJson(response)) {
      const type = asString(event.type);
      if (type === 'message_start') {
        const usage = asRecord(asRecord(event.message).usage);
        inputTokens = typeof usage.input_tokens === 'number' ? usage.input_tokens : inputTokens;
        outputTokens = typeof usage.output_tokens === 'number' ? usage.output_tokens : outputTokens;
      } else if (type === 'content_block_start') {
        const block = asRecord(event.content_block);
        if (block.type === 'tool_use') {
          yield {
            type: 'tool_call_delta',
            index: typeof event.index === 'number' ? event.index : 0,
            ...(asString(block.id) ? { id: asString(block.id) } : {}),
            ...(asString(block.name) ? { name: asString(block.name) } : {}),
            argumentsDelta: '',
          };
        }
      } else if (type === 'content_block_delta') {
        const delta = asRecord(event.delta);
        if (delta.type === 'text_delta') {
          const text = asString(delta.text);
          if (text) yield { type: 'text_delta', text };
        } else if (delta.type === 'input_json_delta') {
          yield {
            type: 'tool_call_delta',
            index: typeof event.index === 'number' ? event.index : 0,
            argumentsDelta: asString(delta.partial_json) ?? '',
          };
        }
      } else if (type === 'message_delta') {
        const delta = asRecord(event.delta);
        const usage = asRecord(event.usage);
        stopReason = delta.stop_reason;
        outputTokens = typeof usage.output_tokens === 'number' ? usage.output_tokens : outputTokens;
      } else if (type === 'message_stop') {
        yield usageEvent(inputTokens, outputTokens);
        yield completionReason(stopReason);
      }
    }
  },
};
