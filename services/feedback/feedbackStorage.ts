import {
    AccountStorageAdapter,
    getStorageForAccount,
} from '@/services/account/accountScopedStorage';
import {
    AccountOperationContext,
    assertAccountOperationActive,
    registerAccountTeardown,
    runAccountBoundOperation,
} from '@/services/account/accountRuntime';

export type AiFeedbackValue = 'up' | 'down';
export type AiFeedbackScope = 'intention' | 'journal';

export interface AiFeedbackRecord {
    id: string;
    scope: AiFeedbackScope;
    messageId: string;
    conversationId?: string;
    personaId?: string;
    value: AiFeedbackValue;
    comment?: string;
    messageContent: string;
    createdAt: number;
    updatedAt: number;
}

export interface SaveAiFeedbackInput {
    scope: AiFeedbackScope;
    messageId: string;
    conversationId?: string;
    personaId?: string;
    value: AiFeedbackValue;
    comment?: string;
    messageContent: string;
}

export const AI_FEEDBACK_STORAGE_KEY = '@ai_response_feedback';

function buildFeedbackId(input: SaveAiFeedbackInput): string {
    const scope = input.scope;
    const owner = input.personaId ?? input.conversationId ?? 'global';
    return `${scope}:${owner}:${input.messageId}`;
}

let mutationQueue: Promise<void> = Promise.resolve();

registerAccountTeardown(() => {
    mutationQueue = Promise.resolve();
});

function enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const result = mutationQueue.then(operation, operation);
    mutationQueue = result.then(() => undefined, () => undefined);
    return result;
}

async function loadMap(
    storage: AccountStorageAdapter,
    context: AccountOperationContext,
): Promise<Record<string, AiFeedbackRecord>> {
    const json = await storage.getItem(AI_FEEDBACK_STORAGE_KEY);
    assertAccountOperationActive(context);
    if (!json) return {};
    try {
        const parsed = JSON.parse(json) as unknown;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed as Record<string, AiFeedbackRecord>
            : {};
    } catch {
        return {};
    }
}

async function saveMap(
    storage: AccountStorageAdapter,
    map: Record<string, AiFeedbackRecord>,
    context: AccountOperationContext,
): Promise<void> {
    assertAccountOperationActive(context);
    await storage.setItem(AI_FEEDBACK_STORAGE_KEY, JSON.stringify(map));
    assertAccountOperationActive(context);
}

function trimText(value: string, maxLength: number): string {
    const trimmed = value.trim().replace(/\s+/g, ' ');
    return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength).trim()}...` : trimmed;
}

function describeRecord(record: AiFeedbackRecord): string {
    const comment = trimText(record.comment ?? '', 140);
    const excerpt = trimText(record.messageContent, 120);
    return comment || `Response excerpt: "${excerpt}"`;
}

export function saveAiFeedback(input: SaveAiFeedbackInput): Promise<AiFeedbackRecord> {
    return runAccountBoundOperation('feedback-save', (context) => enqueueMutation(async () => {
        const storage = getStorageForAccount(context.accountId);
        const map = await loadMap(storage, context);
        const id = buildFeedbackId(input);
        const now = Date.now();
        const existing = map[id];
        const record: AiFeedbackRecord = {
            id,
            scope: input.scope,
            messageId: input.messageId,
            conversationId: input.conversationId,
            personaId: input.personaId,
            value: input.value,
            comment: input.comment?.trim(),
            messageContent: input.messageContent.trim(),
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
        };

        map[id] = record;
        await saveMap(storage, map, context);
        return record;
    }));
}

export function listAiFeedback(scope?: AiFeedbackScope): Promise<AiFeedbackRecord[]> {
    return runAccountBoundOperation('feedback-list', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        const map = await loadMap(storage, context);
        const records = Object.values(map);
        const filtered = scope ? records.filter((record) => record.scope === scope) : records;
        assertAccountOperationActive(context);
        return filtered.sort((a, b) => b.updatedAt - a.updatedAt);
    });
}

export function buildFeedbackGuidance(records: readonly AiFeedbackRecord[]): string | undefined {
    const recent = records.slice(0, 8);
    const liked = recent.filter((record) => record.value === 'up').slice(0, 4);
    const disliked = recent.filter((record) => record.value === 'down').slice(0, 4);
    if (liked.length === 0 && disliked.length === 0) return undefined;

    const sections = [
        liked.length > 0
            ? `Do more of this tone/style: ${liked.map(describeRecord).join(' | ')}`
            : undefined,
        disliked.length > 0
            ? `Avoid this tone/style: ${disliked.map(describeRecord).join(' | ')}`
            : undefined,
    ].filter(Boolean);

    return [
        '## Response Feedback Memory',
        'Adapt future responses using these saved user reactions.',
        ...sections,
    ].join('\n');
}
