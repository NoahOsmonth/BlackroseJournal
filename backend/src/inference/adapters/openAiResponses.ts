import type { NormalizedInferenceEvent } from '../../../../packages/ai-control-plane-contracts/src';
import type { ProviderAdapter } from './types';
import {
  appendPath,
  asArray,
  asRecord,
  asString,
  completionReason,
  inputContent,
  put,
  readSseJson,
  usageEvent,
} from './shared';

export const openAiResponsesAdapter: ProviderAdapter = {
  buildRequest(input) {
    const body: Record<string, unknown> = {
      model: input.modelId,
      input: input.request.messages.map((message) => message.role === 'tool'
        ? {
            type: 'function_call_output',
            call_id: message.toolCallId ?? message.name ?? '',
            output: typeof message.content === 'string'
              ? message.content
              : message.content.filter((part) => part.type === 'text')
                .map((part) => part.text).join('\n'),
          }
        : { role: message.role, content: inputContent(message.content) }),
      stream: input.request.stream,
    };
    put(body, 'instructions', input.request.systemInstruction);
    put(body, 'tools', input.request.tools?.map((tool) => ({
      type: 'function', name: tool.name, description: tool.description, parameters: tool.inputSchema,
    })));
    put(body, 'tool_choice', typeof input.request.toolChoice === 'object'
      ? { type: 'function', name: input.request.toolChoice.name }
      : input.request.toolChoice);
    const format = input.request.responseFormat;
    put(body, 'text', format ? { format: format.type === 'json_schema'
      ? { type: 'json_schema', name: format.name, schema: format.schema, ...(format.strict === undefined ? {} : { strict: format.strict }) }
      : { type: format.type } } : undefined);
    put(body, 'temperature', input.request.temperature);
    put(body, 'top_p', input.request.topP);
    put(body, 'max_output_tokens', input.request.maxOutputTokens);
    return {
      url: appendPath(input.provider.baseUrl, 'responses'),
      headers: { authorization: `Bearer ${input.secret}` },
      body,
    };
  },
  parseNonStream(value) {
    const root = asRecord(value);
    const events: NormalizedInferenceEvent[] = [];
    for (const raw of asArray(root.output)) {
      const item = asRecord(raw);
      if (item.type === 'message') {
        for (const rawPart of asArray(item.content)) {
          const part = asRecord(rawPart);
          const text = asString(part.text);
          if (part.type === 'output_text' && text) events.push({ type: 'text_delta' as const, text });
        }
      } else if (item.type === 'function_call') {
        events.push({
          type: 'tool_call_delta' as const,
          index: events.filter((event) => event.type === 'tool_call_delta').length,
          id: asString(item.call_id) ?? asString(item.id),
          name: asString(item.name),
          argumentsDelta: asString(item.arguments) ?? '',
        });
      }
    }
    const usage = asRecord(root.usage);
    if (Object.keys(usage).length > 0) {
      events.push(usageEvent(usage.input_tokens, usage.output_tokens, usage.total_tokens));
    }
    events.push(completionReason(root.incomplete_details ? 'length' : root.status));
    return events;
  },
  async *parseStream(response) {
    for await (const event of readSseJson(response)) {
      const type = asString(event.type);
      if (type === 'response.output_text.delta') {
        const delta = asString(event.delta);
        if (delta) yield { type: 'text_delta', text: delta };
      } else if (type === 'response.output_item.added') {
        const item = asRecord(event.item);
        if (item.type === 'function_call') {
          yield {
            type: 'tool_call_delta',
            index: typeof event.output_index === 'number' ? event.output_index : 0,
            ...(asString(item.call_id) || asString(item.id)
              ? { id: asString(item.call_id) ?? asString(item.id) }
              : {}),
            ...(asString(item.name) ? { name: asString(item.name) } : {}),
            argumentsDelta: '',
          };
        }
      } else if (type === 'response.function_call_arguments.delta') {
        yield {
          type: 'tool_call_delta',
          index: typeof event.output_index === 'number' ? event.output_index : 0,
          argumentsDelta: asString(event.delta) ?? '',
        };
      } else if (type === 'response.completed' || type === 'response.incomplete') {
        const completed = asRecord(event.response);
        const usage = asRecord(completed.usage);
        if (Object.keys(usage).length > 0) {
          yield usageEvent(usage.input_tokens, usage.output_tokens, usage.total_tokens);
        }
        yield completionReason(type === 'response.incomplete' ? 'length' : completed.status);
      }
    }
  },
};
