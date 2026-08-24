import type { NormalizedInferenceEvent } from '../../../../packages/ai-control-plane-contracts/src';
import type { ProviderAdapter } from './types';
import {
  appendPath,
  asArray,
  asRecord,
  asString,
  completionReason,
  openAiContent,
  openAiToolChoice,
  put,
  readSseJson,
  responseFormat,
  usageEvent,
} from './shared';

export const openAiChatCompletionsAdapter: ProviderAdapter = {
  buildRequest(input) {
    const body: Record<string, unknown> = {
      model: input.modelId,
      messages: [
        ...(input.request.systemInstruction
          ? [{ role: 'system', content: input.request.systemInstruction }]
          : []),
        ...input.request.messages.map((message) => ({
          role: message.role,
          content: openAiContent(message.content),
          ...(message.name ? { name: message.name } : {}),
          ...(message.toolCallId ? { tool_call_id: message.toolCallId } : {}),
        })),
      ],
      stream: input.request.stream,
    };
    put(body, 'tools', input.request.tools?.map((tool) => ({
      type: 'function',
      function: { name: tool.name, description: tool.description, parameters: tool.inputSchema },
    })));
    put(body, 'tool_choice', openAiToolChoice(input.request.toolChoice));
    put(body, 'response_format', responseFormat(input.request.responseFormat));
    put(body, 'temperature', input.request.temperature);
    put(body, 'top_p', input.request.topP);
    put(body, 'max_tokens', input.request.maxOutputTokens);
    return {
      url: appendPath(input.provider.baseUrl, 'chat/completions'),
      headers: { authorization: `Bearer ${input.secret}` },
      body,
    };
  },
  parseNonStream(value) {
    const root = asRecord(value);
    const choice = asRecord(asArray(root.choices)[0]);
    const message = asRecord(choice.message);
    const events: NormalizedInferenceEvent[] = [];
    const content = asString(message.content);
    if (content) events.push({ type: 'text_delta' as const, text: content });
    for (const [index, raw] of asArray(message.tool_calls).entries()) {
      const call = asRecord(raw);
      const fn = asRecord(call.function);
      events.push({
        type: 'tool_call_delta' as const,
        index,
        id: asString(call.id),
        name: asString(fn.name),
        argumentsDelta: asString(fn.arguments) ?? '',
      });
    }
    const usage = asRecord(root.usage);
    if (Object.keys(usage).length > 0) {
      events.push(usageEvent(usage.prompt_tokens, usage.completion_tokens, usage.total_tokens));
    }
    events.push(completionReason(choice.finish_reason));
    return events;
  },
  async *parseStream(response) {
    let finishReason: unknown;
    for await (const root of readSseJson(response)) {
      const choice = asRecord(asArray(root.choices)[0]);
      const delta = asRecord(choice.delta);
      const content = asString(delta.content);
      if (content) yield { type: 'text_delta', text: content };
      for (const raw of asArray(delta.tool_calls)) {
        const call = asRecord(raw);
        const fn = asRecord(call.function);
        yield {
          type: 'tool_call_delta',
          index: typeof call.index === 'number' ? call.index : 0,
          ...(asString(call.id) ? { id: asString(call.id) } : {}),
          ...(asString(fn.name) ? { name: asString(fn.name) } : {}),
          argumentsDelta: asString(fn.arguments) ?? '',
        };
      }
      if (choice.finish_reason !== undefined && choice.finish_reason !== null) {
        finishReason = choice.finish_reason;
      }
      const usage = asRecord(root.usage);
      if (Object.keys(usage).length > 0) {
        yield usageEvent(usage.prompt_tokens, usage.completion_tokens, usage.total_tokens);
      }
    }
    yield completionReason(finishReason);
  },
};
