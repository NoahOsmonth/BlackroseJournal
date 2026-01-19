import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Message } from './ai';
import { JournalEntry, StorageAdapter } from './journalStorage.types';
import { getSupermemoryConfig } from './supermemoryConfig';

const CONTAINER_TAG_KEY = '@supermemory_container_tag';
const DEFAULT_THRESHOLD = 0.6;
const DEFAULT_LIMIT = 6;
const DEFAULT_TIME_RANGE_LABEL = 'All-time';

export type SupermemorySearchMode = 'memories' | 'hybrid';

export type TimeRange = 'all-time' | 'this-year' | 'this-month' | 'this-week';

export interface SupermemoryProfile {
    static: string[];
    dynamic: string[];
}

export interface SupermemorySearchResult {
    memory?: string;
    chunk?: string;
    metadata?: Record<string, unknown> | null;
}

export interface SupermemoryProfileResponse {
    profile: SupermemoryProfile;
    searchResults?: {
        results: SupermemorySearchResult[];
        total?: number;
        timing?: number;
    };
}

export interface SupermemorySearchResponse {
    results: SupermemorySearchResult[];
    total?: number;
    timing?: number;
}

export interface SupermemoryFilters {
    AND?: SupermemoryFilterCondition[];
    OR?: SupermemoryFilterCondition[];
}

export interface SupermemoryFilterCondition {
    key: string;
    value: string;
    filterType?: 'metadata' | 'numeric' | 'array_contains' | 'string_contains';
    numericOperator?: '>' | '<' | '>=' | '<=' | '=';
    negate?: boolean;
    ignoreCase?: boolean;
}

let storageAdapter: StorageAdapter = AsyncStorage;
let cachedContainerTag: string | null = null;

export function setSupermemoryStorageAdapter(adapter: StorageAdapter): void {
    storageAdapter = adapter;
    cachedContainerTag = null;
}

export function resetSupermemoryStorageAdapter(): void {
    storageAdapter = AsyncStorage;
    cachedContainerTag = null;
}

function generateContainerTag(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 10);
    return `user_${timestamp}_${random}`;
}

export async function getOrCreateContainerTag(): Promise<string> {
    if (cachedContainerTag) {
        return cachedContainerTag;
    }

    const stored = await storageAdapter.getItem(CONTAINER_TAG_KEY);
    if (stored) {
        cachedContainerTag = stored;
        return stored;
    }

    const generated = generateContainerTag();
    await storageAdapter.setItem(CONTAINER_TAG_KEY, generated);
    cachedContainerTag = generated;

    return generated;
}

function formatConversation(messages: Message[]): string {
    return messages.map(message => `${message.role}: ${message.content}`).join('\n');
}

function formatEntryContent(entry: JournalEntry): string {
    const header = `Title: ${entry.title}\nEmoji: ${entry.emoji}\nStatus: ${entry.status}`;
    const body = formatConversation(entry.messages);

    return [header, body].filter(Boolean).join('\n\n');
}

function buildEntryMetadata(entry: JournalEntry): Record<string, string | number | boolean> {
    const createdDate = new Date(entry.createdAt);

    return {
        entry_id: entry.id,
        entry_status: entry.status,
        entry_title: entry.title,
        entry_emoji: entry.emoji,
        entry_type: 'journal_entry',
        entry_created_at: entry.createdAt,
        entry_updated_at: entry.updatedAt,
        entry_timestamp: entry.createdAt,
        entry_year: createdDate.getFullYear(),
        entry_month: createdDate.getMonth() + 1,
        entry_day: createdDate.getDate(),
    };
}

async function parseJsonSafely(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) {
        return null;
    }

    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

async function buildSupermemoryError(response: Response, context: string): Promise<Error> {
    const rawText = await response.text().catch(() => '');
    const preview = rawText.slice(0, 200);
    const details = preview ? ` Preview: ${preview}` : '';

    return new Error(`${context} (status ${response.status}).${details}`);
}

/**
 * Makes a request to the Supermemory API.
 * On web, routes through a local API proxy to avoid CORS issues.
 * On native platforms, calls the API directly.
 */
async function requestSupermemory<T>(
    path: string,
    body: unknown,
    expectJson = true,
    defaultOnNotFound?: T
): Promise<T> {
    console.log('[Supermemory] Request:', path, JSON.stringify(body));

    let response: Response;

    if (Platform.OS === 'web') {
        // On web, use the local API proxy to avoid CORS issues
        response = await fetch('/api/supermemory', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ path, ...body as object }),
        });
    } else {
        // On native, call the API directly
        const { apiBaseUrl, apiKey } = getSupermemoryConfig();
        response = await fetch(`${apiBaseUrl}${path}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
        });
    }

    // Handle 404 gracefully - container/memories may not exist yet
    if (response.status === 404 && defaultOnNotFound !== undefined) {
        console.log('[Supermemory] Resource not found, returning default');
        return defaultOnNotFound;
    }

    if (!response.ok) {
        const error = await buildSupermemoryError(response, 'Supermemory request failed');
        console.error('[Supermemory] Error:', error.message);
        throw error;
    }

    if (!expectJson) {
        return undefined as T;
    }

    const parsed = await parseJsonSafely(response);
    console.log('[Supermemory] Response:', JSON.stringify(parsed));
    if (!parsed) {
        throw new Error('Supermemory response was not valid JSON.');
    }

    return parsed as T;
}

const EMPTY_PROFILE_RESPONSE: SupermemoryProfileResponse = {
    profile: { static: [], dynamic: [] },
    searchResults: { results: [], total: 0 },
};

const EMPTY_SEARCH_RESPONSE: SupermemorySearchResponse = {
    results: [],
    total: 0,
};

export async function getSupermemoryProfile(
    containerTag: string,
    query?: string,
    threshold = DEFAULT_THRESHOLD
): Promise<SupermemoryProfileResponse> {
    const body = {
        containerTag,
        q: query,
        threshold,
    };

    return requestSupermemory<SupermemoryProfileResponse>(
        '/v4/profile',
        body,
        true,
        EMPTY_PROFILE_RESPONSE
    );
}

export async function searchMemories(options: {
    containerTag: string;
    query: string;
    searchMode: SupermemorySearchMode;
    filters?: SupermemoryFilters;
    limit?: number;
    threshold?: number;
}): Promise<SupermemorySearchResponse> {
    const body = {
        containerTag: options.containerTag,
        q: options.query,
        searchMode: options.searchMode,
        filters: options.filters,
        limit: options.limit ?? DEFAULT_LIMIT,
        threshold: options.threshold ?? DEFAULT_THRESHOLD,
    };

    return requestSupermemory<SupermemorySearchResponse>(
        '/v4/search',
        body,
        true,
        EMPTY_SEARCH_RESPONSE
    );
}

export async function ingestJournalEntry(entry: JournalEntry): Promise<void> {
    const containerTag = await getOrCreateContainerTag();
    const content = formatEntryContent(entry);
    const metadata = buildEntryMetadata(entry);

    await requestSupermemory('/v3/documents', {
        content,
        containerTag,
        customId: entry.id,
        metadata,
    }, false);
}

export async function ingestConversation(
    conversationId: string,
    messages: Message[]
): Promise<void> {
    const containerTag = await getOrCreateContainerTag();
    const payload = {
        conversationId,
        messages: messages.map(message => ({
            role: message.role,
            content: message.content,
        })),
        containerTags: [containerTag],
        metadata: {
            conversation_id: conversationId,
            source: 'chat',
        },
    };

    await requestSupermemory('/v4/conversations', payload, false);
}

function formatProfileSection(title: string, values: string[] | undefined): string {
    if (!values || values.length === 0) {
        return `${title}: None`;
    }

    return `${title}:\n${values.join('\n')}`;
}

function formatMemoryResults(results: SupermemorySearchResult[]): string {
    if (results.length === 0) {
        return 'Relevant memories: None';
    }

    const lines = results
        .map(result => result.memory || result.chunk)
        .filter(Boolean) as string[];

    if (lines.length === 0) {
        return 'Relevant memories: None';
    }

    return `Relevant memories:\n${lines.join('\n')}`;
}

export function formatMemoryContext(options: {
    profile: SupermemoryProfile;
    results: SupermemorySearchResult[];
    label?: string;
}): string {
    const header = options.label
        ? `## User Memory Context (${options.label})`
        : '## User Memory Context';
    const staticSection = formatProfileSection('Static profile', options.profile.static);
    const dynamicSection = formatProfileSection('Recent context', options.profile.dynamic);
    const memoriesSection = formatMemoryResults(options.results);

    return [header, staticSection, dynamicSection, memoriesSection].join('\n\n');
}

export async function buildChatMemoryContext(query: string): Promise<string> {
    const containerTag = await getOrCreateContainerTag();
    const profile = await getSupermemoryProfile(containerTag, query);

    return formatMemoryContext({
        profile: profile.profile,
        results: profile.searchResults?.results ?? [],
    });
}

interface AskRosebudSearchOptions {
    label: string;
    searchMode: SupermemorySearchMode;
    filters?: SupermemoryFilters;
}

function buildTimestampFilters(start: number, end: number): SupermemoryFilters {
    return {
        AND: [
            {
                filterType: 'numeric',
                key: 'entry_timestamp',
                numericOperator: '>=',
                value: String(start),
            },
            {
                filterType: 'numeric',
                key: 'entry_timestamp',
                numericOperator: '<=',
                value: String(end),
            },
        ],
    };
}

function buildAskRosebudSearchOptions(timeRange: TimeRange, now: Date): AskRosebudSearchOptions {
    const end = now.getTime();

    if (timeRange === 'this-week') {
        const start = new Date(now);
        start.setDate(start.getDate() - 7);
        return {
            label: 'This week',
            searchMode: 'memories',
            filters: buildTimestampFilters(start.getTime(), end),
        };
    }

    if (timeRange === 'this-month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
            label: 'This month',
            searchMode: 'memories',
            filters: buildTimestampFilters(start.getTime(), end),
        };
    }

    if (timeRange === 'this-year') {
        const start = new Date(now.getFullYear(), 0, 1);
        return {
            label: 'This year',
            searchMode: 'hybrid',
            filters: buildTimestampFilters(start.getTime(), end),
        };
    }

    return {
        label: DEFAULT_TIME_RANGE_LABEL,
        searchMode: 'hybrid',
    };
}

export async function buildAskRosebudContext(options: {
    question: string;
    timeRange: TimeRange;
    now?: Date;
}): Promise<string> {
    const containerTag = await getOrCreateContainerTag();
    const profileResponse = await getSupermemoryProfile(containerTag);
    const searchOptions = buildAskRosebudSearchOptions(options.timeRange, options.now ?? new Date());
    const searchResponse = await searchMemories({
        containerTag,
        query: options.question,
        searchMode: searchOptions.searchMode,
        filters: searchOptions.filters,
    });

    return formatMemoryContext({
        profile: profileResponse.profile,
        results: searchResponse.results ?? [],
        label: searchOptions.label,
    });
}
