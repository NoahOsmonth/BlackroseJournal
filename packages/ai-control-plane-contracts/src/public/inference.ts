import {
  ContractValidationError,
  expectArray,
  expectBoolean,
  expectEnum,
  expectExactKeys,
  expectInteger,
  expectJsonObject,
  expectNumber,
  expectRecord,
  expectString,
  includeOptional,
  JsonValue,
} from '../validation';

export type InferencePurpose = 'chat' | 'flash';
export type InferenceRole = 'system' | 'user' | 'assistant' | 'tool';

export type InferenceContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string; mediaType?: string };

export interface InferenceMessage {
  role: InferenceRole;
  content: string | InferenceContentPart[];
  name?: string;
  toolCallId?: string;
}

export interface InferenceTool {
  name: string;
  description: string;
  inputSchema: { [key: string]: JsonValue };
}

export type InferenceToolChoice = 'auto' | 'none' | 'required' | { name: string };
export type InferenceResponseFormat =
  | { type: 'text' }
  | { type: 'json_object' }
  | { type: 'json_schema'; name: string; schema: { [key: string]: JsonValue }; strict?: boolean };

export interface NormalizedInferenceRequest {
  purpose: InferencePurpose;
  messages: InferenceMessage[];
  systemInstruction?: string;
  tools?: InferenceTool[];
  toolChoice?: InferenceToolChoice;
  responseFormat?: InferenceResponseFormat;
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  stream: boolean;
}

export interface NormalizedInferenceExecutionRequest extends NormalizedInferenceRequest {
  signal?: AbortSignal;
}

export type NormalizedInferenceErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'invalid_request'
  | 'model_unavailable'
  | 'rate_limited'
  | 'upstream_timeout'
  | 'upstream_error'
  | 'aborted'
  | 'internal_error';

export interface NormalizedInferenceError {
  code: NormalizedInferenceErrorCode;
  message: string;
  retryable: boolean;
  status?: number;
}

export type InferenceCompletionReason =
  | 'stop'
  | 'length'
  | 'tool_calls'
  | 'content_filter'
  | 'error'
  | 'cancelled';

export type NormalizedInferenceEvent =
  | { type: 'text_delta'; text: string }
  | {
      type: 'tool_call_delta';
      index: number;
      id?: string;
      name?: string;
      argumentsDelta: string;
    }
  | { type: 'usage'; inputTokens: number; outputTokens: number; totalTokens: number }
  | { type: 'completion'; reason: InferenceCompletionReason }
  | { type: 'error'; error: NormalizedInferenceError };

const parseContentPart = (value: unknown, path: string): InferenceContentPart => {
  const record = expectRecord(value, path);
  const type = expectEnum(record.type, ['text', 'image'], `${path}.type`);
  if (type === 'text') {
    expectExactKeys(record, ['type', 'text'], path);
    return { type, text: expectString(record.text, `${path}.text`) };
  }
  expectExactKeys(record, ['type', 'url', 'mediaType'], path);
  const result: Record<string, unknown> = {
    type,
    url: expectString(record.url, `${path}.url`),
  };
  includeOptional(result, 'mediaType', record.mediaType, expectString, path);
  return result as unknown as InferenceContentPart;
};

const parseMessage = (value: unknown, path: string): InferenceMessage => {
  const record = expectRecord(value, path);
  expectExactKeys(record, ['role', 'content', 'name', 'toolCallId'], path);
  const content =
    typeof record.content === 'string'
      ? expectString(record.content, `${path}.content`)
      : expectArray(record.content, `${path}.content`, parseContentPart);
  const result: Record<string, unknown> = {
    role: expectEnum(record.role, ['system', 'user', 'assistant', 'tool'], `${path}.role`),
    content,
  };
  includeOptional(result, 'name', record.name, expectString, path);
  includeOptional(result, 'toolCallId', record.toolCallId, expectString, path);
  return result as unknown as InferenceMessage;
};

const parseTool = (value: unknown, path: string): InferenceTool => {
  const record = expectRecord(value, path);
  expectExactKeys(record, ['name', 'description', 'inputSchema'], path);
  return {
    name: expectString(record.name, `${path}.name`),
    description: expectString(record.description, `${path}.description`),
    inputSchema: expectJsonObject(record.inputSchema, `${path}.inputSchema`),
  };
};

const parseToolChoice = (value: unknown, path: string): InferenceToolChoice => {
  if (typeof value === 'string') {
    return expectEnum(value, ['auto', 'none', 'required'] as const, path);
  }
  const record = expectRecord(value, path);
  expectExactKeys(record, ['name'], path);
  return { name: expectString(record.name, `${path}.name`) };
};

const parseResponseFormat = (value: unknown, path: string): InferenceResponseFormat => {
  const record = expectRecord(value, path);
  const type = expectEnum(record.type, ['text', 'json_object', 'json_schema'], `${path}.type`);
  if (type !== 'json_schema') {
    expectExactKeys(record, ['type'], path);
    return { type };
  }
  expectExactKeys(record, ['type', 'name', 'schema', 'strict'], path);
  const result: Record<string, unknown> = {
    type,
    name: expectString(record.name, `${path}.name`),
    schema: expectJsonObject(record.schema, `${path}.schema`),
  };
  includeOptional(result, 'strict', record.strict, expectBoolean, path);
  return result as unknown as InferenceResponseFormat;
};

export const parseNormalizedInferenceRequest = (
  value: unknown,
): NormalizedInferenceRequest => {
  const path = 'inferenceRequest';
  const record = expectRecord(value, path);
  expectExactKeys(
    record,
    [
      'purpose',
      'messages',
      'systemInstruction',
      'tools',
      'toolChoice',
      'responseFormat',
      'temperature',
      'topP',
      'maxOutputTokens',
      'stream',
    ],
    path,
  );
  const result: Record<string, unknown> = {
    purpose: expectEnum(record.purpose, ['chat', 'flash'], `${path}.purpose`),
    messages: expectArray(record.messages, `${path}.messages`, parseMessage),
    stream: expectBoolean(record.stream, `${path}.stream`),
  };
  includeOptional(result, 'systemInstruction', record.systemInstruction, expectString, path);
  includeOptional(result, 'tools', record.tools, (item, itemPath) =>
    expectArray(item, itemPath, parseTool), path);
  includeOptional(result, 'toolChoice', record.toolChoice, parseToolChoice, path);
  includeOptional(result, 'responseFormat', record.responseFormat, parseResponseFormat, path);
  includeOptional(result, 'temperature', record.temperature, (item, itemPath) =>
    expectNumber(item, itemPath, 0, 2), path);
  includeOptional(result, 'topP', record.topP, (item, itemPath) =>
    expectNumber(item, itemPath, 0, 1), path);
  includeOptional(result, 'maxOutputTokens', record.maxOutputTokens, (item, itemPath) =>
    expectInteger(item, itemPath, 1), path);
  return result as unknown as NormalizedInferenceRequest;
};

export const parseNormalizedInferenceError = (
  value: unknown,
  path = 'inferenceError',
): NormalizedInferenceError => {
  const record = expectRecord(value, path);
  expectExactKeys(record, ['code', 'message', 'retryable', 'status'], path);
  const result: Record<string, unknown> = {
    code: expectEnum(
      record.code,
      [
        'unauthorized',
        'forbidden',
        'invalid_request',
        'model_unavailable',
        'rate_limited',
        'upstream_timeout',
        'upstream_error',
        'aborted',
        'internal_error',
      ],
      `${path}.code`,
    ),
    message: expectString(record.message, `${path}.message`),
    retryable: expectBoolean(record.retryable, `${path}.retryable`),
  };
  includeOptional(result, 'status', record.status, (item, itemPath) =>
    expectInteger(item, itemPath, 100), path);
  return result as unknown as NormalizedInferenceError;
};

export const parseNormalizedInferenceEvent = (value: unknown): NormalizedInferenceEvent => {
  const path = 'inferenceEvent';
  const record = expectRecord(value, path);
  const type = expectEnum(
    record.type,
    ['text_delta', 'tool_call_delta', 'usage', 'completion', 'error'],
    `${path}.type`,
  );
  if (type === 'text_delta') {
    expectExactKeys(record, ['type', 'text'], path);
    return { type, text: expectString(record.text, `${path}.text`) };
  }
  if (type === 'tool_call_delta') {
    expectExactKeys(record, ['type', 'index', 'id', 'name', 'argumentsDelta'], path);
    if (typeof record.argumentsDelta !== 'string') {
      throw new ContractValidationError(`${path}.argumentsDelta`, 'expected a string');
    }
    const result: Record<string, unknown> = {
      type,
      index: expectInteger(record.index, `${path}.index`),
      argumentsDelta: record.argumentsDelta,
    };
    includeOptional(result, 'id', record.id, expectString, path);
    includeOptional(result, 'name', record.name, expectString, path);
    return result as unknown as NormalizedInferenceEvent;
  }
  if (type === 'usage') {
    expectExactKeys(record, ['type', 'inputTokens', 'outputTokens', 'totalTokens'], path);
    return {
      type,
      inputTokens: expectInteger(record.inputTokens, `${path}.inputTokens`),
      outputTokens: expectInteger(record.outputTokens, `${path}.outputTokens`),
      totalTokens: expectInteger(record.totalTokens, `${path}.totalTokens`),
    };
  }
  if (type === 'completion') {
    expectExactKeys(record, ['type', 'reason'], path);
    return {
      type,
      reason: expectEnum(
        record.reason,
        ['stop', 'length', 'tool_calls', 'content_filter', 'error', 'cancelled'],
        `${path}.reason`,
      ),
    };
  }
  expectExactKeys(record, ['type', 'error'], path);
  return { type, error: parseNormalizedInferenceError(record.error, `${path}.error`) };
};
