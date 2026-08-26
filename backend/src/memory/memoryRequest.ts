import {
  parseMemoryRebuildRequest, parseMemoryRecallRequest, parseMemoryReflectRequest,
  parseMemoryRetainRequest,
  type MemoryRebuildItem, type MemoryRetainRequest,
} from '../../../packages/ai-control-plane-contracts/src';

function identifierTokens(value: string): string[] {
  return value.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}
export function containsBankSelector(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsBankSelector);
  return Object.entries(value).some(([key, item]) => (
    identifierTokens(key).includes('bank') || containsBankSelector(item)
  ));
}

export type MemoryOperation = 'retain' | 'recall' | 'reflect' | 'rebuild';
const MAX_REQUEST_BYTES = 2 * 1024 * 1024;
const MAX_CONTENT_BYTES = 64 * 1024;
const MAX_QUERY_LENGTH = 16 * 1024;

function validDate(value: string | undefined): boolean {
  return value === undefined || !Number.isNaN(Date.parse(value));
}
function validRecord(item: MemoryRetainRequest | MemoryRebuildItem): boolean {
  const documentId = 'documentId' in item ? item.documentId : undefined;
  const createdAt = 'createdAt' in item ? item.createdAt : undefined;
  return Boolean(item.content.trim()) && Buffer.byteLength(item.content, 'utf8') <= MAX_CONTENT_BYTES
    && (documentId === undefined || (documentId.length > 0 && documentId.length <= 512))
    && validDate(createdAt);
}

export function parseMemoryRequest(operation: MemoryOperation, value: unknown): unknown | null {
  try {
    if (Buffer.byteLength(JSON.stringify(value), 'utf8') > MAX_REQUEST_BYTES || containsBankSelector(value)) return null;
    if (operation === 'retain') {
      const request = parseMemoryRetainRequest(value);
      return validRecord(request) ? request : null;
    }
    if (operation === 'rebuild') {
      const request = parseMemoryRebuildRequest(value);
      return request.items.length >= 1 && request.items.length <= 500 && request.items.every(validRecord)
        ? request : null;
    }
    if (operation === 'recall') {
      const request = parseMemoryRecallRequest(value);
      return request.query.trim() && request.query.length <= MAX_QUERY_LENGTH
        && (request.limit ?? 6) <= 50 ? { ...request, query: request.query.trim() } : null;
    }
    const request = parseMemoryReflectRequest(value);
    return request.query.trim() && request.query.length <= MAX_QUERY_LENGTH
      && (request.maxResults ?? 6) <= 50 ? { ...request, query: request.query.trim() } : null;
  } catch { return null; }
}
