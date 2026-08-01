import {
    MEMORY_CONTRACT_VERSION,
    type CanonicalConversationSource,
    type CanonicalMessageSource,
} from './contracts';
import { conversationSourceId, parseMessageClientEventId } from './sourceIds';

export const MIRROR_CHUNK_LIMITS = {
    maxConversations: 16,
    maxMessages: 128,
    maxEncodedJsonBytes: 256 * 1024,
} as const;

export type MirrorSourceKind = 'journal' | 'intention_checkin';

export interface MirrorMessage extends CanonicalMessageSource {
    previousAcceptedRevision: number | null;
}

export interface MirrorConversation extends Omit<CanonicalConversationSource, 'sourceKind' | 'sourceRevision'> {
    sourceKind: MirrorSourceKind;
    sourceRevision: number;
    previousAcceptedRevision: number | null;
    messages: MirrorMessage[];
}

export interface MirrorChunk {
    contractVersion: typeof MEMORY_CONTRACT_VERSION;
    manifestId: string;
    chunkIndex: number;
    conversations: MirrorConversation[];
}

export type MirrorContractErrorCode =
    | 'UNKNOWN_KEY'
    | 'INVALID_TYPE'
    | 'INVALID_VALUE'
    | 'INVALID_LIMIT'
    | 'UNSUPPORTED_NUL';

export class MirrorContractError extends Error {
    constructor(readonly code: MirrorContractErrorCode) {
        super(code);
        this.name = 'MirrorContractError';
    }
}

function invalid(code: MirrorContractErrorCode): never {
    throw new MirrorContractError(code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function expectExactKeys(value: Record<string, unknown>, keys: readonly string[]): void {
    if (Object.keys(value).length !== keys.length || !keys.every((key) => key in value)) {
        invalid('UNKNOWN_KEY');
    }
}

function string(value: unknown): string {
    if (typeof value !== 'string') invalid('INVALID_TYPE');
    if (value.includes('\u0000')) invalid('UNSUPPORTED_NUL');
    return value;
}

function nonEmptyString(value: unknown): string {
    const result = string(value);
    if (!result) invalid('INVALID_VALUE');
    return result;
}

function positiveInteger(value: unknown): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
        invalid('INVALID_VALUE');
    }
    return value;
}

function nonNegativeInteger(value: unknown): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
        invalid('INVALID_VALUE');
    }
    return value;
}

function optionalRevision(value: unknown, revision: number): number | null {
    if (value === null) return null;
    const previous = positiveInteger(value);
    if (previous >= revision) invalid('INVALID_VALUE');
    return previous;
}

function timestamp(value: unknown): string {
    const result = string(value);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(result)) {
        invalid('INVALID_VALUE');
    }
    const parsed = new Date(result);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== result) {
        invalid('INVALID_VALUE');
    }
    return result;
}

function nullableTimestamp(value: unknown): string | null {
    return value === null ? null : timestamp(value);
}

function localDate(value: unknown): string {
    const result = string(value);
    const parsed = new Date(`${result}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(result)
        || !Number.isFinite(parsed.getTime())
        || parsed.toISOString().slice(0, 10) !== result) {
        invalid('INVALID_VALUE');
    }
    return result;
}

function timezone(value: unknown): string {
    const result = nonEmptyString(value);
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: result });
    } catch {
        invalid('INVALID_VALUE');
    }
    return result;
}

function localDateForTimestamp(authoredAt: string, authoredTimezone: string): string {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: authoredTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date(authoredAt));
    const part = (type: Intl.DateTimeFormatPartTypes): string | undefined => (
        parts.find((item) => item.type === type)?.value
    );
    const year = part('year');
    const month = part('month');
    const day = part('day');
    if (!year || !month || !day) invalid('INVALID_VALUE');
    return `${year}-${month}-${day}`;
}

function temporal(value: Record<string, unknown>, authoredAt: string): {
    authoredTimezone: string | null;
    localDate: string | null;
    temporalProvenance: 'captured' | 'legacy_unknown';
} {
    if (value.temporalProvenance === 'legacy_unknown') {
        if (value.authoredTimezone !== null || value.localDate !== null) invalid('INVALID_VALUE');
        return {
            authoredTimezone: null,
            localDate: null,
            temporalProvenance: 'legacy_unknown',
        };
    }
    if (value.temporalProvenance !== 'captured') invalid('INVALID_VALUE');
    const authoredTimezone = timezone(value.authoredTimezone);
    const capturedLocalDate = localDate(value.localDate);
    if (localDateForTimestamp(authoredAt, authoredTimezone) !== capturedLocalDate) {
        invalid('INVALID_VALUE');
    }
    return {
        authoredTimezone,
        localDate: capturedLocalDate,
        temporalProvenance: 'captured',
    };
}

function parseMessage(value: unknown, conversationId: string): MirrorMessage {
    if (!isRecord(value)) invalid('INVALID_TYPE');
    expectExactKeys(value, [
        'id', 'conversationId', 'clientEventId', 'role', 'sequence', 'authoredAt',
        'authoredTimezone', 'localDate', 'temporalProvenance', 'content', 'revision',
        'previousAcceptedRevision', 'status',
    ]);
    const revision = positiveInteger(value.revision);
    const authoredAt = timestamp(value.authoredAt);
    const captured = temporal(value, authoredAt);
    if (value.conversationId !== conversationId) invalid('INVALID_VALUE');
    if (value.role !== 'user' && value.role !== 'assistant') invalid('INVALID_VALUE');
    if (value.status !== 'active' && value.status !== 'edited' && value.status !== 'deleted') {
        invalid('INVALID_VALUE');
    }
    const id = nonEmptyString(value.id);
    const clientEventId = nonEmptyString(value.clientEventId);
    if (clientEventId !== id || parseMessageClientEventId(id)?.conversationId !== conversationId) {
        invalid('INVALID_VALUE');
    }
    return {
        id,
        conversationId,
        clientEventId,
        role: value.role,
        sequence: nonNegativeInteger(value.sequence),
        authoredAt,
        ...captured,
        content: string(value.content),
        revision,
        previousAcceptedRevision: optionalRevision(value.previousAcceptedRevision, revision),
        status: value.status,
    };
}

function parseConversation(value: unknown): MirrorConversation {
    if (!isRecord(value)) invalid('INVALID_TYPE');
    expectExactKeys(value, [
        'id', 'sourceKind', 'sourceRecordId', 'status', 'startedAt', 'settledAt', 'timezone',
        'weekStartsOn', 'temporalProvenance', 'clientSchemaVersion', 'sourceRevision',
        'previousAcceptedRevision', 'messages',
    ]);
    const sourceRevision = positiveInteger(value.sourceRevision);
    if (value.sourceKind !== 'journal' && value.sourceKind !== 'intention_checkin') {
        invalid('INVALID_VALUE');
    }
    if (value.status !== 'settled') invalid('INVALID_VALUE');
    if (value.settledAt !== null || value.timezone !== null || value.weekStartsOn !== null
        || value.temporalProvenance !== 'legacy_unknown' || value.clientSchemaVersion !== MEMORY_CONTRACT_VERSION) {
        invalid('INVALID_VALUE');
    }
    if (!Array.isArray(value.messages)) invalid('INVALID_TYPE');
    const id = nonEmptyString(value.id);
    const sourceRecordId = nonEmptyString(value.sourceRecordId);
    if (conversationSourceId(value.sourceKind, sourceRecordId) !== id) invalid('INVALID_VALUE');
    const messages = value.messages.map((message) => parseMessage(message, id));
    if (new Set(messages.map((message) => message.id)).size !== messages.length) invalid('INVALID_VALUE');
    if (messages.some((message, index) => message.sequence !== index)) invalid('INVALID_VALUE');
    return {
        id,
        sourceKind: value.sourceKind,
        sourceRecordId,
        status: 'settled',
        startedAt: timestamp(value.startedAt),
        settledAt: nullableTimestamp(value.settledAt),
        timezone: null,
        weekStartsOn: null,
        temporalProvenance: 'legacy_unknown',
        clientSchemaVersion: MEMORY_CONTRACT_VERSION,
        sourceRevision,
        previousAcceptedRevision: optionalRevision(value.previousAcceptedRevision, sourceRevision),
        messages,
    };
}

function sourceSemantics(value: MirrorConversation): string {
    return JSON.stringify({
        id: value.id,
        sourceKind: value.sourceKind,
        sourceRecordId: value.sourceRecordId,
        status: value.status,
        startedAt: value.startedAt,
        settledAt: value.settledAt,
        timezone: value.timezone,
        weekStartsOn: value.weekStartsOn,
        temporalProvenance: value.temporalProvenance,
        clientSchemaVersion: value.clientSchemaVersion,
        messages: value.messages.map((message) => ({
            id: message.id,
            conversationId: message.conversationId,
            clientEventId: message.clientEventId,
            role: message.role,
            sequence: message.sequence,
            authoredAt: message.authoredAt,
            authoredTimezone: message.authoredTimezone,
            localDate: message.localDate,
            temporalProvenance: message.temporalProvenance,
            content: message.content,
            status: message.status,
        })),
    });
}

/** Source owners call this with the previous and next exact local snapshots. */
export function nextSourceRevision(
    previous: MirrorConversation,
    next: MirrorConversation,
): number {
    const current = positiveInteger(previous.sourceRevision);
    return sourceSemantics(previous) === sourceSemantics(next) ? current : current + 1;
}

export function parseMirrorChunk(value: unknown): MirrorChunk {
    if (!isRecord(value)) invalid('INVALID_TYPE');
    expectExactKeys(value, ['contractVersion', 'manifestId', 'chunkIndex', 'conversations']);
    if (value.contractVersion !== MEMORY_CONTRACT_VERSION) invalid('INVALID_VALUE');
    if (!Array.isArray(value.conversations)) invalid('INVALID_TYPE');
    if (value.conversations.length === 0 || value.conversations.length > MIRROR_CHUNK_LIMITS.maxConversations) {
        invalid('INVALID_LIMIT');
    }
    const conversations = value.conversations.map(parseConversation);
    const messageCount = conversations.reduce((total, conversation) => total + conversation.messages.length, 0);
    if (messageCount > MIRROR_CHUNK_LIMITS.maxMessages) invalid('INVALID_LIMIT');
    if (new Set(conversations.map((conversation) => conversation.id)).size !== conversations.length) {
        invalid('INVALID_VALUE');
    }
    const clientEventIds = conversations.flatMap((conversation) => (
        conversation.messages.map((message) => message.clientEventId)
    ));
    if (new Set(clientEventIds).size !== clientEventIds.length) invalid('INVALID_VALUE');
    const chunk: MirrorChunk = {
        contractVersion: MEMORY_CONTRACT_VERSION,
        manifestId: nonEmptyString(value.manifestId),
        chunkIndex: nonNegativeInteger(value.chunkIndex),
        conversations,
    };
    if (new TextEncoder().encode(JSON.stringify(chunk)).byteLength > MIRROR_CHUNK_LIMITS.maxEncodedJsonBytes) {
        invalid('INVALID_LIMIT');
    }
    return chunk;
}
