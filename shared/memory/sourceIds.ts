import { MEMORY_SOURCE_KINDS, type MemorySourceKind } from './contracts';

function assertSegment(name: string, value: string): void {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${name} must not be empty`);
  }
}

function isMemorySourceKind(value: unknown): value is MemorySourceKind {
  return typeof value === 'string'
    && (MEMORY_SOURCE_KINDS as readonly string[]).includes(value);
}

export function conversationSourceId(kind: MemorySourceKind, recordId: string): string {
  if (!isMemorySourceKind(kind)) {
    throw new Error('kind must be a canonical memory source kind');
  }
  assertSegment('recordId', recordId);
  return `${kind}:${encodeURIComponent(recordId)}`;
}

export function parseConversationSourceId(value: string): {
  kind: MemorySourceKind;
  recordId: string;
} | null {
  if (typeof value !== 'string') return null;
  const separator = value.indexOf(':');
  if (separator <= 0) return null;

  const kind = value.slice(0, separator);
  if (!isMemorySourceKind(kind)) return null;

  try {
    const recordId = decodeURIComponent(value.slice(separator + 1));
    if (!recordId) return null;
    if (conversationSourceId(kind, recordId) !== value) return null;
    return { kind, recordId };
  } catch {
    return null;
  }
}

export function messageClientEventId(conversationId: string, messageId: string): string {
  assertSegment('conversationId', conversationId);
  assertSegment('messageId', messageId);
  if (!parseConversationSourceId(conversationId)) {
    throw new Error('conversationId must be a canonical conversation source ID');
  }
  return `${encodeURIComponent(conversationId)}:${encodeURIComponent(messageId)}`;
}

export function parseMessageClientEventId(value: string): {
  conversationId: string;
  messageId: string;
} | null {
  if (typeof value !== 'string') return null;
  const separator = value.indexOf(':');
  if (separator <= 0) return null;

  try {
    const conversationId = decodeURIComponent(value.slice(0, separator));
    const messageId = decodeURIComponent(value.slice(separator + 1));
    if (!messageId || !parseConversationSourceId(conversationId)) return null;
    if (messageClientEventId(conversationId, messageId) !== value) return null;
    return { conversationId, messageId };
  } catch {
    return null;
  }
}
