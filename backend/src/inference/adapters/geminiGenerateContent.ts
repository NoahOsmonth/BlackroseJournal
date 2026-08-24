import type { NormalizedInferenceEvent } from '../../../../packages/ai-control-plane-contracts/src';
import type { ProviderAdapter } from './types';
import {
  appendPath,
  asArray,
  asRecord,
  asString,
  completionReason,
  geminiParts,
  put,
  readSseJson,
  usageEvent,
} from './shared';

export const geminiGenerateContentAdapter: ProviderAdapter = {
  buildRequest(input) {
    const generationConfig: Record<string, unknown> = {};
    put(generationConfig, 'temperature', input.request.temperature);
    put(generationConfig, 'topP', input.request.topP);
    put(generationConfig, 'maxOutputTokens', input.request.maxOutputTokens);
    if (input.request.responseFormat?.type === 'json_object') {
      generationConfig.responseMimeType = 'application/json';
    } else if (input.request.responseFormat?.type === 'json_schema') {
      generationConfig.responseMimeType = 'application/json';
      generationConfig.responseJsonSchema = input.request.responseFormat.schema;
    }
    const body: Record<string, unknown> = {
      contents: input.request.messages
        .filter((message) => message.role !== 'system')
        .map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: geminiParts(message.content),
        })),
    };
    const systemText = [
      input.request.systemInstruction,
      ...input.request.messages.filter((message) => message.role === 'system')
        .map((message) => typeof message.content === 'string' ? message.content : ''),
    ].filter(Boolean).join('\n\n');
    put(body, 'systemInstruction', systemText ? { parts: [{ text: systemText }] } : undefined);
    put(body, 'tools', input.request.tools ? [{ functionDeclarations: input.request.tools.map((tool) => ({
      name: tool.name, description: tool.description, parameters: tool.inputSchema,
    })) }] : undefined);
    const choice = input.request.toolChoice;
    put(body, 'toolConfig', choice ? { functionCallingConfig: typeof choice === 'object'
      ? { mode: 'ANY', allowedFunctionNames: [choice.name] }
      : { mode: choice === 'required' ? 'ANY' : choice.toUpperCase() } } : undefined);
    if (Object.keys(generationConfig).length > 0) body.generationConfig = generationConfig;
    const operation = input.request.stream ? 'streamGenerateContent?alt=sse' : 'generateContent';
    return {
      url: appendPath(input.provider.baseUrl, `models/${encodeURIComponent(input.modelId)}:${operation}`),
      headers: { 'x-goog-api-key': input.secret },
      body,
    };
  },
  parseNonStream(value) {
    const root = asRecord(value);
    const candidate = asRecord(asArray(root.candidates)[0]);
    const content = asRecord(candidate.content);
    const events: NormalizedInferenceEvent[] = [];
    for (const [index, raw] of asArray(content.parts).entries()) {
      const part = asRecord(raw);
      const text = asString(part.text);
      if (text) events.push({ type: 'text_delta' as const, text });
      const call = asRecord(part.functionCall);
      if (Object.keys(call).length > 0) {
        events.push({
          type: 'tool_call_delta' as const,
          index,
          name: asString(call.name),
          argumentsDelta: JSON.stringify(call.args ?? {}),
        });
      }
    }
    const usage = asRecord(root.usageMetadata);
    if (Object.keys(usage).length > 0) {
      events.push(usageEvent(usage.promptTokenCount, usage.candidatesTokenCount, usage.totalTokenCount));
    }
    events.push(completionReason(candidate.finishReason));
    return events;
  },
  async *parseStream(response) {
    let finishReason: unknown;
    let latestUsage: Record<string, unknown> | undefined;
    for await (const root of readSseJson(response)) {
      const candidate = asRecord(asArray(root.candidates)[0]);
      const content = asRecord(candidate.content);
      for (const [index, raw] of asArray(content.parts).entries()) {
        const part = asRecord(raw);
        const text = asString(part.text);
        if (text) yield { type: 'text_delta', text };
        const call = asRecord(part.functionCall);
        if (Object.keys(call).length > 0) {
          yield {
            type: 'tool_call_delta',
            index,
            ...(asString(call.name) ? { name: asString(call.name) } : {}),
            argumentsDelta: JSON.stringify(call.args ?? {}),
          };
        }
      }
      if (candidate.finishReason !== undefined) finishReason = candidate.finishReason;
      const usage = asRecord(root.usageMetadata);
      if (Object.keys(usage).length > 0) latestUsage = usage;
    }
    if (latestUsage) {
      yield usageEvent(
        latestUsage.promptTokenCount,
        latestUsage.candidatesTokenCount,
        latestUsage.totalTokenCount,
      );
    }
    yield completionReason(finishReason);
  },
};
