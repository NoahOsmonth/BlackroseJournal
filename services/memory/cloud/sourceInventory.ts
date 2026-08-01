import type { IntentionCheckIn } from '../../intentions/intentionsStorage.types';
import type { JournalEntry } from '../../journal/journalStorage.types';
import {
    MEMORY_CONTRACT_VERSION,
    type CanonicalConversationSource,
    type CanonicalMessageSource,
    type MemorySourceInventory,
    type MemorySourceKind,
} from '../../../shared/memory/contracts';
import {
    conversationSourceId,
    messageClientEventId,
} from '../../../shared/memory/sourceIds';

export type MemorySourceInventoryErrorCode =
    | 'INVALID_ID'
    | 'INVALID_TIMESTAMP'
    | 'INVALID_REVISION'
    | 'DUPLICATE_CANONICAL_ID';

export class MemorySourceInventoryError extends Error {
    constructor(readonly code: MemorySourceInventoryErrorCode) {
        super(code);
        this.name = 'MemorySourceInventoryError';
    }
}

export interface BuildMemorySourceInventoryInput {
    entries: readonly JournalEntry[];
    checkIns: readonly IntentionCheckIn[];
    generatedAt: Date;
}

interface LegacyConversationInput {
    sourceKind: Extract<MemorySourceKind, 'journal' | 'intention_checkin'>;
    sourceRecordId: string;
    createdAt: number;
    messages: JournalEntry['messages'];
    sourceRevision?: number;
}

interface InventoryParts {
    conversation: CanonicalConversationSource;
    messages: CanonicalMessageSource[];
}

function invalid(code: MemorySourceInventoryErrorCode): never {
    throw new MemorySourceInventoryError(code);
}

function canonicalId(
    value: string,
    create: () => string,
): string {
    if (typeof value !== 'string' || value.trim() === '') {
        return invalid('INVALID_ID');
    }
    try {
        return create();
    } catch {
        return invalid('INVALID_ID');
    }
}

function timestamp(value: number | Date): string {
    const milliseconds = value instanceof Date ? value.getTime() : value;
    if (
        typeof milliseconds !== 'number'
        || !Number.isFinite(milliseconds)
    ) {
        return invalid('INVALID_TIMESTAMP');
    }
    try {
        return new Date(milliseconds).toISOString();
    } catch {
        return invalid('INVALID_TIMESTAMP');
    }
}

function revision(value: unknown): number {
    if (value === undefined) return 1;
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
        return invalid('INVALID_REVISION');
    }
    return value;
}

function temporalMetadata(message: JournalEntry['messages'][number]): Pick<
    CanonicalMessageSource,
    'authoredTimezone' | 'localDate' | 'temporalProvenance'
> {
    if (
        message.temporalProvenance === 'captured'
        && typeof message.authoredTimezone === 'string'
        && message.authoredTimezone.length > 0
        && typeof message.localDate === 'string'
        && /^\d{4}-\d{2}-\d{2}$/.test(message.localDate)
    ) {
        return {
            authoredTimezone: message.authoredTimezone,
            localDate: message.localDate,
            temporalProvenance: 'captured',
        };
    }
    return {
        authoredTimezone: null,
        localDate: null,
        temporalProvenance: 'legacy_unknown',
    };
}

function mapLegacyConversation(
    source: LegacyConversationInput,
): InventoryParts {
    const conversationId = canonicalId(
        source.sourceRecordId,
        () => conversationSourceId(source.sourceKind, source.sourceRecordId),
    );
    const conversation: CanonicalConversationSource = {
        id: conversationId,
        sourceKind: source.sourceKind,
        sourceRecordId: source.sourceRecordId,
        status: 'settled',
        startedAt: timestamp(source.createdAt),
        settledAt: null,
        timezone: null,
        weekStartsOn: null,
        temporalProvenance: 'legacy_unknown',
        clientSchemaVersion: MEMORY_CONTRACT_VERSION,
        sourceRevision: revision(source.sourceRevision),
    };
    const messages = source.messages.map((rawMessage, sequence) => {
        const id = canonicalId(
            rawMessage.id,
            () => messageClientEventId(conversationId, rawMessage.id),
        );
        return {
            id,
            conversationId,
            clientEventId: id,
            role: rawMessage.role,
            sequence,
            authoredAt: timestamp(rawMessage.timestamp),
            ...temporalMetadata(rawMessage),
            content: rawMessage.content,
            revision: revision(rawMessage.revision),
            status: 'active',
        } satisfies CanonicalMessageSource;
    });
    return { conversation, messages };
}

function assertUnique(
    values: readonly string[],
): void {
    if (new Set(values).size !== values.length) {
        invalid('DUPLICATE_CANONICAL_ID');
    }
}

export function buildMemorySourceInventory(
    input: BuildMemorySourceInventoryInput,
): MemorySourceInventory {
    const generatedAt = timestamp(input.generatedAt);
    const journalSources: LegacyConversationInput[] = input.entries
        .filter((entry) => entry.status === 'completed')
        .map((entry) => ({
            sourceKind: 'journal',
            sourceRecordId: entry.id,
            createdAt: entry.createdAt,
            messages: entry.messages,
            sourceRevision: entry.sourceRevision,
        }));
    const checkInSources: LegacyConversationInput[] = input.checkIns
        .filter((checkIn) => checkIn.status === 'completed')
        .map((checkIn) => ({
            sourceKind: 'intention_checkin',
            sourceRecordId: checkIn.id,
            createdAt: checkIn.createdAt,
            messages: checkIn.messages ?? [],
            sourceRevision: checkIn.sourceRevision,
        }));
    const parts = [...journalSources, ...checkInSources]
        .map(mapLegacyConversation);

    assertUnique(parts.map(({ conversation }) => conversation.id));
    assertUnique(parts.flatMap(({ messages }) => (
        messages.map((message) => message.id)
    )));

    const conversations = parts
        .map(({ conversation }) => conversation)
        .sort((left, right) => (
            left.startedAt.localeCompare(right.startedAt)
            || left.id.localeCompare(right.id)
        ));
    const conversationOrder = new Map(
        conversations.map((conversation, index) => [conversation.id, index]),
    );
    const messages = parts
        .flatMap((part) => part.messages)
        .sort((left, right) => (
            (conversationOrder.get(left.conversationId) ?? -1)
            - (conversationOrder.get(right.conversationId) ?? -1)
            || left.sequence - right.sequence
            || left.id.localeCompare(right.id)
        ));
    const authored = messages.map((message) => message.authoredAt).sort();

    return {
        contractVersion: MEMORY_CONTRACT_VERSION,
        generatedAt,
        conversationCount: conversations.length,
        messageCount: messages.length,
        oldestAuthoredAt: authored[0] ?? null,
        newestAuthoredAt: authored.at(-1) ?? null,
        conversations,
        messages,
    };
}
