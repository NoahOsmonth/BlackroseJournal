import type {
    JournalEntry,
    MemoryGraphAtom,
    MemoryLayer,
} from './memoryGraph.types';

const KIMI_API_URL = 'https://api.moonshot.cn/v1/chat/completions';
const MODEL_NAME = 'kimi-k2.5:thinking';
const MEMORY_LAYERS: MemoryLayer[] = [
    'episodic',
    'semantic',
    'profile',
    'procedural',
    'note',
    'working',
];

interface KimiResponse {
    choices: {
        message: {
            content: string;
        };
    }[];
}

interface ClassificationResult {
    layer?: MemoryLayer;
    salience?: number;
    confidence?: number;
    tags?: string[];
}

function clamp(value: unknown, fallback: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, Number(value) || fallback));
}

function normalizeLayer(layer: unknown): MemoryLayer {
    return MEMORY_LAYERS.includes(layer as MemoryLayer) ? layer as MemoryLayer : 'note';
}

function fallbackAtom(entry: JournalEntry): MemoryGraphAtom {
    return {
        id: `atom_${entry.id}`,
        entryId: entry.id,
        source: 'journal',
        title: entry.title || 'Fallback Node',
        content: entry.content,
        layer: 'note',
        salience: 3,
        confidence: 0.5,
        tags: [],
        createdAt: entry.createdAt,
    };
}

function buildAtom(entry: JournalEntry, result: ClassificationResult): MemoryGraphAtom {
    return {
        id: `atom_${entry.id}`,
        entryId: entry.id,
        source: 'journal',
        title: entry.title || `Memory ${entry.createdAt}`,
        content: entry.content,
        layer: normalizeLayer(result.layer),
        salience: clamp(result.salience, 3, 1, 10),
        confidence: clamp(result.confidence, 0.5, 0, 1),
        tags: Array.isArray(result.tags) ? result.tags.filter(Boolean) : [],
        createdAt: entry.createdAt,
    };
}

function systemPrompt(): string {
    return `You are the core memory classification engine for Blackrose Journal.
Analyze the provided journal entry and classify it into exactly one of these
memory layers: episodic, semantic, profile, procedural, note, working.
Respond strictly with valid JSON containing layer, salience, confidence, tags.`;
}

export async function classifyJournalEntry(
    entry: JournalEntry,
    apiKey: string
): Promise<MemoryGraphAtom> {
    try {
        const response = await fetch(KIMI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: MODEL_NAME,
                messages: [
                    { role: 'system', content: systemPrompt() },
                    { role: 'user', content: `Journal Entry Content:\n${entry.content}` },
                ],
                response_format: { type: 'json_object' },
            }),
        });

        if (!response.ok) {
            throw new Error(`Kimi API connection failure: ${response.statusText}`);
        }

        const data = await response.json() as KimiResponse;
        const parsed = JSON.parse(data.choices[0]?.message?.content ?? '{}');
        return buildAtom(entry, parsed);
    } catch {
        return fallbackAtom(entry);
    }
}

export async function classifyJournalEntries(
    entries: JournalEntry[],
    apiKey: string
): Promise<MemoryGraphAtom[]> {
    return Promise.all(entries.map((entry) => classifyJournalEntry(entry, apiKey)));
}
