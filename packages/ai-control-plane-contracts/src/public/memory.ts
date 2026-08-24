import {
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

export type MemoryMetadata = { [key: string]: JsonValue };

export interface MemoryRetainRequest {
  documentId?: string;
  content: string;
  createdAt?: string;
  metadata?: MemoryMetadata;
}

export interface MemoryRecallRequest {
  query: string;
  limit?: number;
}

export interface MemoryReflectRequest {
  query: string;
  maxResults?: number;
}

export type MemoryRebuildItemKind = 'journal' | 'check_in';

export interface MemoryRebuildItem {
  documentId: string;
  kind: MemoryRebuildItemKind;
  content: string;
  createdAt: string;
  metadata?: MemoryMetadata;
}

export interface MemoryRebuildRequest {
  items: MemoryRebuildItem[];
}

export type MemoryClearRequest = Record<string, never>;
export interface MemoryRetainResponse { retained: boolean }
export interface MemoryRecallResult {
  documentId: string;
  content: string;
  score: number;
  metadata?: MemoryMetadata;
}
export interface MemoryRecallResponse { results: MemoryRecallResult[] }
export interface MemoryReflectResponse { reflection: string }
export interface MemoryRebuildResponse { accepted: number }
export interface MemoryClearResponse { cleared: boolean }

const parseMetadata = (value: unknown, path: string): MemoryMetadata =>
  expectJsonObject(value, path);

export const parseMemoryRetainRequest = (value: unknown): MemoryRetainRequest => {
  const path = 'memoryRetainRequest';
  const record = expectRecord(value, path);
  expectExactKeys(record, ['documentId', 'content', 'createdAt', 'metadata'], path);
  const result: Record<string, unknown> = {
    content: expectString(record.content, `${path}.content`),
  };
  includeOptional(result, 'documentId', record.documentId, expectString, path);
  includeOptional(result, 'createdAt', record.createdAt, expectString, path);
  includeOptional(result, 'metadata', record.metadata, parseMetadata, path);
  return result as unknown as MemoryRetainRequest;
};

export const parseMemoryRecallRequest = (value: unknown): MemoryRecallRequest => {
  const path = 'memoryRecallRequest';
  const record = expectRecord(value, path);
  expectExactKeys(record, ['query', 'limit'], path);
  const result: Record<string, unknown> = {
    query: expectString(record.query, `${path}.query`),
  };
  includeOptional(result, 'limit', record.limit, (item, itemPath) =>
    expectInteger(item, itemPath, 1), path);
  return result as unknown as MemoryRecallRequest;
};

export const parseMemoryReflectRequest = (value: unknown): MemoryReflectRequest => {
  const path = 'memoryReflectRequest';
  const record = expectRecord(value, path);
  expectExactKeys(record, ['query', 'maxResults'], path);
  const result: Record<string, unknown> = {
    query: expectString(record.query, `${path}.query`),
  };
  includeOptional(result, 'maxResults', record.maxResults, (item, itemPath) =>
    expectInteger(item, itemPath, 1), path);
  return result as unknown as MemoryReflectRequest;
};

const parseMemoryRebuildItem = (value: unknown, path: string): MemoryRebuildItem => {
  const record = expectRecord(value, path);
  expectExactKeys(record, ['documentId', 'kind', 'content', 'createdAt', 'metadata'], path);
  const result: Record<string, unknown> = {
    documentId: expectString(record.documentId, `${path}.documentId`),
    kind: expectEnum(record.kind, ['journal', 'check_in'], `${path}.kind`),
    content: expectString(record.content, `${path}.content`),
    createdAt: expectString(record.createdAt, `${path}.createdAt`),
  };
  includeOptional(result, 'metadata', record.metadata, parseMetadata, path);
  return result as unknown as MemoryRebuildItem;
};

export const parseMemoryRebuildRequest = (value: unknown): MemoryRebuildRequest => {
  const path = 'memoryRebuildRequest';
  const record = expectRecord(value, path);
  expectExactKeys(record, ['items'], path);
  return {
    items: expectArray(record.items, `${path}.items`, parseMemoryRebuildItem),
  };
};

export const parseMemoryClearRequest = (value: unknown): MemoryClearRequest => {
  const path = 'memoryClearRequest';
  const record = expectRecord(value, path);
  expectExactKeys(record, [], path);
  return {};
};

export const parseMemoryRetainResponse = (value: unknown): MemoryRetainResponse => {
  const path = 'memoryRetainResponse';
  const record = expectRecord(value, path);
  expectExactKeys(record, ['retained'], path);
  return { retained: expectBoolean(record.retained, `${path}.retained`) };
};

const parseMemoryRecallResult = (value: unknown, path: string): MemoryRecallResult => {
  const record = expectRecord(value, path);
  expectExactKeys(record, ['documentId', 'content', 'score', 'metadata'], path);
  const result: Record<string, unknown> = {
    documentId: expectString(record.documentId, `${path}.documentId`),
    content: expectString(record.content, `${path}.content`),
    score: expectNumber(record.score, `${path}.score`, 0, 1),
  };
  includeOptional(result, 'metadata', record.metadata, parseMetadata, path);
  return result as unknown as MemoryRecallResult;
};

export const parseMemoryRecallResponse = (value: unknown): MemoryRecallResponse => {
  const path = 'memoryRecallResponse';
  const record = expectRecord(value, path);
  expectExactKeys(record, ['results'], path);
  return {
    results: expectArray(record.results, `${path}.results`, parseMemoryRecallResult),
  };
};

export const parseMemoryReflectResponse = (value: unknown): MemoryReflectResponse => {
  const path = 'memoryReflectResponse';
  const record = expectRecord(value, path);
  expectExactKeys(record, ['reflection'], path);
  return { reflection: expectString(record.reflection, `${path}.reflection`) };
};

export const parseMemoryRebuildResponse = (value: unknown): MemoryRebuildResponse => {
  const path = 'memoryRebuildResponse';
  const record = expectRecord(value, path);
  expectExactKeys(record, ['accepted'], path);
  return { accepted: expectInteger(record.accepted, `${path}.accepted`) };
};

export const parseMemoryClearResponse = (value: unknown): MemoryClearResponse => {
  const path = 'memoryClearResponse';
  const record = expectRecord(value, path);
  expectExactKeys(record, ['cleared'], path);
  return { cleared: expectBoolean(record.cleared, `${path}.cleared`) };
};
