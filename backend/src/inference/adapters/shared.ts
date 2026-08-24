import type {
  InferenceContentPart,
  InferenceResponseFormat,
  InferenceToolChoice,
  NormalizedInferenceEvent,
} from '../../../../packages/ai-control-plane-contracts/src';

export const appendPath = (baseUrl: string, path: string): string =>
  `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

export const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

export const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

export const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

export const asNumber = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

export const put = (
  target: Record<string, unknown>,
  key: string,
  value: unknown,
): void => {
  if (value !== undefined) target[key] = value;
};

export const openAiContent = (content: string | InferenceContentPart[]): unknown =>
  typeof content === 'string'
    ? content
    : content.map((part) => part.type === 'text'
      ? { type: 'text', text: part.text }
      : { type: 'image_url', image_url: { url: part.url } });

export const inputContent = (content: string | InferenceContentPart[]): unknown[] =>
  (typeof content === 'string' ? [{ type: 'text' as const, text: content }] : content)
    .map((part) => part.type === 'text'
      ? { type: 'input_text', text: part.text }
      : { type: 'input_image', image_url: part.url });

export const blockContent = (content: string | InferenceContentPart[]): unknown[] =>
  (typeof content === 'string' ? [{ type: 'text' as const, text: content }] : content)
    .map((part) => part.type === 'text'
      ? { type: 'text', text: part.text }
      : { type: 'image', source: { type: 'url', url: part.url } });

export const geminiParts = (content: string | InferenceContentPart[]): unknown[] =>
  (typeof content === 'string' ? [{ type: 'text' as const, text: content }] : content)
    .map((part) => part.type === 'text'
      ? { text: part.text }
      : { fileData: { fileUri: part.url, ...(part.mediaType ? { mimeType: part.mediaType } : {}) } });

export const openAiToolChoice = (choice: InferenceToolChoice | undefined): unknown => {
  if (typeof choice === 'object') {
    return { type: 'function', function: { name: choice.name } };
  }
  return choice;
};

export const responseFormat = (format: InferenceResponseFormat | undefined): unknown => {
  if (!format) return undefined;
  if (format.type !== 'json_schema') return { type: format.type };
  return {
    type: 'json_schema',
    json_schema: {
      name: format.name,
      schema: format.schema,
      ...(format.strict === undefined ? {} : { strict: format.strict }),
    },
  };
};

export const completionReason = (reason: unknown): NormalizedInferenceEvent => {
  const normalized = typeof reason === 'string' ? reason.toLowerCase() : '';
  if (['length', 'max_tokens', 'max_output_tokens'].includes(normalized)) {
    return { type: 'completion', reason: 'length' };
  }
  if (['tool_calls', 'tool_use', 'function_call'].includes(normalized)) {
    return { type: 'completion', reason: 'tool_calls' };
  }
  if (['content_filter', 'safety', 'recitation', 'blocked'].includes(normalized)) {
    return { type: 'completion', reason: 'content_filter' };
  }
  return { type: 'completion', reason: 'stop' };
};

export const usageEvent = (input: unknown, output: unknown, total?: unknown): NormalizedInferenceEvent => {
  const inputTokens = asNumber(input);
  const outputTokens = asNumber(output);
  return {
    type: 'usage',
    inputTokens,
    outputTokens,
    totalTokens: typeof total === 'number' ? total : inputTokens + outputTokens,
  };
};

export async function* readSseJson(response: Response): AsyncGenerator<Record<string, unknown>> {
  if (!response.body) throw new Error('provider stream has no response body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, '\n');
    let boundary = buffer.indexOf('\n\n');
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = block.split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (data && data !== '[DONE]') yield asRecord(JSON.parse(data) as unknown);
      boundary = buffer.indexOf('\n\n');
    }
    if (done) break;
  }
  const data = buffer.split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n');
  if (data && data !== '[DONE]') yield asRecord(JSON.parse(data) as unknown);
}
