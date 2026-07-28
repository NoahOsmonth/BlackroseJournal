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
            authoredTimezone: null,
            localDate: null,
            temporalProvenance: 'legacy_unknown',
            content: rawMessage.content,
            revision: 1,
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
        }));
    const checkInSources: LegacyConversationInput[] = input.checkIns
        .filter((checkIn) => checkIn.status === 'completed')
        .map((checkIn) => ({
            sourceKind: 'intention_checkin',
            sourceRecordId: checkIn.id,
            createdAt: checkIn.createdAt,
            messages: checkIn.messages ?? [],
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
