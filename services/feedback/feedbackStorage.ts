import AsyncStorage from '@react-native-async-storage/async-storage';

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

async function loadMap(): Promise<Record<string, AiFeedbackRecord>> {
    const json = await AsyncStorage.getItem(AI_FEEDBACK_STORAGE_KEY);
    return json ? (JSON.parse(json) as Record<string, AiFeedbackRecord>) : {};
}

async function saveMap(map: Record<string, AiFeedbackRecord>): Promise<void> {
    await AsyncStorage.setItem(AI_FEEDBACK_STORAGE_KEY, JSON.stringify(map));
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

export async function saveAiFeedback(input: SaveAiFeedbackInput): Promise<AiFeedbackRecord> {
    const map = await loadMap();
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
    await saveMap(map);
    return record;
}

export async function listAiFeedback(scope?: AiFeedbackScope): Promise<AiFeedbackRecord[]> {
    const map = await loadMap();
    const records = Object.values(map);
    const filtered = scope ? records.filter((record) => record.scope === scope) : records;
    return filtered.sort((a, b) => b.updatedAt - a.updatedAt);
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
