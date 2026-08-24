function identifierTokens(value: string): string[] {
  return value
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowlist = new Set(allowed);
  return Object.keys(value).every((key) => allowlist.has(key));
}

function parseQueryBody(value: unknown, reflect: boolean): Record<string, unknown> | null {
  if (!isRecord(value) || !hasOnlyKeys(value, reflect ? ['query'] : ['query', 'limit', 'strategies'])) {
    return null;
  }
  if (typeof value.query !== 'string' || !value.query.trim() || value.query.length > MAX_QUERY_LENGTH) {
    return null;
  }
  if (reflect) return { query: value.query.trim() };
  const limit = value.limit ?? 6;
  if (!Number.isInteger(limit) || (limit as number) < 1 || (limit as number) > 50) return null;
  if (value.strategies !== undefined && (
    !Array.isArray(value.strategies)
    || value.strategies.length > 8
    || value.strategies.some((item) => typeof item !== 'string' || !item || item.length > 64)
  )) return null;
  return {
    query: value.query.trim(),
    limit,
    ...(value.strategies === undefined ? {} : { strategies: value.strategies }),
  };
}

function parseItemsBody(value: unknown, maximumItems: number): Record<string, unknown> | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ['items'])) return null;
  if (!Array.isArray(value.items) || value.items.length < 1 || value.items.length > maximumItems) {
    return null;
  }
  const items: Record<string, unknown>[] = [];
  for (const item of value.items) {
    if (!isRecord(item) || !hasOnlyKeys(item, ['content', 'timestamp', 'document_id'])) return null;
    if (
      typeof item.content !== 'string'
      || !item.content.trim()
      || Buffer.byteLength(item.content, 'utf8') > MAX_CONTENT_BYTES
      || typeof item.document_id !== 'string'
      || !item.document_id
      || item.document_id.length > 512
    ) return null;
    const timestamp = typeof item.timestamp === 'number'
      ? new Date(item.timestamp)
      : typeof item.timestamp === 'string'
        ? new Date(item.timestamp)
        : null;
    if (!timestamp || Number.isNaN(timestamp.getTime())) return null;
    items.push({
      content: item.content,
      timestamp: timestamp.toISOString(),
      document_id: item.document_id,
    });
  }
  return { items };
}

export function parseMemoryRequest(operation: MemoryOperation, value: unknown): unknown | null {
  let requestBytes: number;
  try {
    requestBytes = Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch {
    return null;
  }
  if (requestBytes > MAX_REQUEST_BYTES || containsBankSelector(value)) return null;
  if (operation === 'retain') return parseItemsBody(value, 100);
  if (operation === 'rebuild') return parseItemsBody(value, 500);
  return parseQueryBody(value, operation === 'reflect');
}
