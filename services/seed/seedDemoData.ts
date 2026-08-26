/**
 * Seed Demo Data (dev-only)
 *
 * Populates the app with a coherent demo dataset so screens are not empty
 * during local development. Production first launch stays empty.
 *
 * Tracking: every seed write records IDs in `@demo_data_seed_record` so
 * clearDemoData can remove only those rows — never title/content matching.
 */

import {
    getStorageForAccount,
} from '@/services/account/accountScopedStorage';
import type { AccountStorageAdapter } from '@/services/account/accountScopedStorage';
import {
    assertAccountOperationActive,
    getActiveAccountId,
    registerAccountTeardown,
    runAccountBoundOperation,
} from '@/services/account/accountRuntime';
import type { AccountOperationContext } from '@/services/account/accountRuntime';
import type { Message } from '@/services/ai/chatTypes';
import {
    createEntry,
    deleteEntry,
    listEntries,
} from '@/services/journal/journalStorage';
import type { JournalEntryAnalysis } from '@/services/journal/journalStorage.types';
import {
    createCheckIn,
    createIntention,
    deleteCheckIn,
    deleteIntention,
    listCheckIns,
    listIntentions,
} from '@/services/intentions/intentionsStorage';
import type { IntentionArea } from '@/services/intentions/intentionsStorage.types';
import {
    createGoal,
    deleteGoal,
    listGoals,
    updateGoal,
} from '@/services/goals/goalsStorage';
import { getLocalDateKey } from '@/utils/date';
import {
    clearDayDigests,
    upsertCheckInDayDigest,
    upsertJournalDayDigest,
} from '@/services/memory/dayDigestStorage';
import {
    deleteMemoryAtom,
    listMemoryAtoms,
    saveGeneratedMemoryNote,
    saveJournalEntryMemories,
    saveManualMemoryNote,
} from '@/services/memory/localMemory';
const DAY_MS = 86_400_000;

/** Flag + tracked seed IDs (deterministic clear — no content matching). */
export const DEMO_SEED_RECORD_KEY = '@demo_data_seed_record';
/** Legacy flag still accepted so older installs do not re-auto-seed. */
export const SEED_FLAG_KEY = '@demo_data_seeded';

export interface DemoSeedRecord {
    schemaVersion: 1;
    journalEntryIds: string[];
    intentionIds: string[];
    checkInIds: string[];
    goalIds: string[];
    memoryAtomIds: string[];
}

/** Test seam: force enable/disable of demo seed UI + auto-seed. */
let demoSeedEnabledOverride: boolean | null = null;

export function setDemoSeedEnabledForTests(value: boolean | null): void {
    demoSeedEnabledOverride = value;
}

/**
 * Demo seed is __DEV__-only in production builds.
 * What would make gate tests fail: removing this check.
 */
export function isDemoSeedEnabled(): boolean {
    if (demoSeedEnabledOverride !== null) return demoSeedEnabledOverride;
    return typeof __DEV__ !== 'undefined' && __DEV__;
}

let seedOperationQueue: Promise<void> = Promise.resolve();
let seedInFlight: { accountId: string | null; promise: Promise<boolean> } | null = null;

registerAccountTeardown(() => {
    seedOperationQueue = Promise.resolve();
    seedInFlight = null;
});

function enqueueSeedOperation<T>(operation: () => Promise<T>): Promise<T> {
    const result = seedOperationQueue.then(operation, operation);
    seedOperationQueue = result.then(() => undefined, () => undefined);
    return result;
}

function daysAgo(count: number): number {
    return Date.now() - count * DAY_MS;
}

function dateKeyDaysAgo(count: number): string {
    return getLocalDateKey(new Date(daysAgo(count)));
}

function msg(
    role: Message['role'],
    content: string,
    timestamp: number,
    idSeed: string
): Message {
    return {
        id: `seed_${idSeed}`,
        role,
        content,
        timestamp,
    };
}

function emptyRecord(): DemoSeedRecord {
    return {
        schemaVersion: 1,
        journalEntryIds: [],
        intentionIds: [],
        checkInIds: [],
        goalIds: [],
        memoryAtomIds: [],
    };
}

async function loadSeedRecord(
    storage: AccountStorageAdapter,
    context: AccountOperationContext,
): Promise<DemoSeedRecord | null> {
    try {
        const raw = await storage.getItem(DEMO_SEED_RECORD_KEY);
        assertAccountOperationActive(context);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<DemoSeedRecord>;
        if (parsed?.schemaVersion !== 1) return null;
        return {
            schemaVersion: 1,
            journalEntryIds: Array.isArray(parsed.journalEntryIds) ? parsed.journalEntryIds : [],
            intentionIds: Array.isArray(parsed.intentionIds) ? parsed.intentionIds : [],
            checkInIds: Array.isArray(parsed.checkInIds) ? parsed.checkInIds : [],
            goalIds: Array.isArray(parsed.goalIds) ? parsed.goalIds : [],
            memoryAtomIds: Array.isArray(parsed.memoryAtomIds) ? parsed.memoryAtomIds : [],
        };
    } catch (error) {
        if (context.signal.aborted) throw error;
        return null;
    }
}

async function saveSeedRecord(
    record: DemoSeedRecord,
    storage: AccountStorageAdapter,
    context: AccountOperationContext,
): Promise<void> {
    const payload = JSON.stringify(record);
    // Write record first, then flag — never flag without a record (clear needs IDs).
    assertAccountOperationActive(context);
    await storage.setItem(DEMO_SEED_RECORD_KEY, payload);
    assertAccountOperationActive(context);
    await storage.setItem(SEED_FLAG_KEY, 'true');
    assertAccountOperationActive(context);
}

export function markDemoDataSeeded(): Promise<void> {
    return runAccountBoundOperation('seed-marked', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        try {
            assertAccountOperationActive(context);
            await storage.setItem(SEED_FLAG_KEY, 'true');
            assertAccountOperationActive(context);
        } catch (error) {
            if (context.signal.aborted) throw error;
            // Non-fatal
        }
    });
}

interface SeedJournalEntry {
    readonly title: string;
    readonly emoji: string;
    readonly daysBack: number;
    readonly userText: string;
    readonly assistantText: string;
    readonly analysis: Omit<JournalEntryAnalysis, 'generatedAt'>;
}

const JOURNAL_SEED: readonly SeedJournalEntry[] = [
    {
        title: 'A slow morning with coffee',
        emoji: '☕',
        daysBack: 0,
        userText:
            "Woke up earlier than usual and just sat with my coffee before the house woke up. Felt calm, almost like I could hear my own thoughts again. I want more mornings like this.",
        assistantText:
            "That sounds like a gentle kind of clarity. What do you think made this morning feel different from the rushed ones?",
        analysis: {
            insight:
                'Slow, unstructured mornings give you a sense of ownership over the day and lower anxiety.',
            quote: 'I could hear my own thoughts again.',
            mood: 'Calm',
            topics: ['morning', 'calm', 'routine'],
        },
    },
    {
        title: 'The argument that kept looping',
        emoji: '🌊',
        daysBack: 2,
        userText:
            "Had a tense exchange with my partner about chores. I kept replaying it on the walk home. I think I was more hurt than angry, but I didn't say that.",
        assistantText:
            "Replaying usually means something underneath went unspoken. If you could tell them the hurt part, what would it sound like?",
        analysis: {
            insight:
                'Under anger there is often unexpressed hurt; naming it changes the conversation.',
            quote: 'I was more hurt than angry.',
            mood: 'Tense',
            topics: ['relationship', 'communication', 'anger'],
        },
    },
    {
        title: 'Finished the 5k plan',
        emoji: '🏃',
        daysBack: 4,
        userText:
            "Completed week four of the running plan. Legs were tired but I felt proud. Movement has been the most reliable mood regulator this month.",
        assistantText:
            "Pride is a good signal you are keeping a promise to yourself. What made it stick this time?",
        analysis: {
            insight: 'Consistent movement is the user’s most reliable mood regulator.',
            quote: 'Movement has been the most reliable mood regulator.',
            mood: 'Proud',
            topics: ['running', 'health', 'consistency'],
        },
    },
    {
        title: 'Quiet doubt about the new role',
        emoji: '🌱',
        daysBack: 6,
        userText:
            "Started the new position and I'm excited, but there's a low hum of 'do I belong here?' I keep comparing myself to people with more years of experience.",
        assistantText:
            "Impostor feelings are common when growth outpaces proof. What would a mentor say about the version of you a year ago?",
        analysis: {
            insight:
                'Career growth triggers comparison-driven self-doubt; grounding in past progress helps.',
            quote: 'A low hum of do I belong here?',
            mood: 'Unsettled',
            topics: ['career', 'confidence', 'growth'],
        },
    },
    {
        title: 'Sunday reset with the family',
        emoji: '🍲',
        daysBack: 9,
        userText:
            "Cooked a long lunch with my sibling and the kids. The noise was nice. I realized I'd been treating rest as something to earn, not something to schedule.",
        assistantText:
            "That's a tender insight. What would change if rest had a standing appointment like a meeting?",
        analysis: {
            insight: 'The user treats rest as earned rather than scheduled; family time restores them.',
            quote: 'Rest as something to earn, not something to schedule.',
            mood: 'Warm',
            topics: ['family', 'rest', 'balance'],
        },
    },
];

interface SeedIntention {
    readonly title: string;
    readonly description: string;
    readonly area: IntentionArea;
    readonly iconKey: string;
    readonly checkIns: readonly {
        readonly type: 'morning' | 'evening' | 'intention';
        readonly daysBack: number;
        readonly title: string;
        readonly summary: string;
        readonly mood: string;
        readonly userText: string;
    }[];
    readonly goals: readonly {
        readonly title: string;
        readonly type: 'goal' | 'habit';
        readonly daysBack: number;
    }[];
}

const INTENTION_SEED: readonly SeedIntention[] = [
    {
        title: 'Protect a calm morning',
        description: 'Keep one slow, phone-free morning block each day before the world arrives.',
        area: 'wellbeing',
        iconKey: 'sunny',
        checkIns: [
            {
                type: 'morning',
                daysBack: 0,
                title: 'Morning intention',
                summary: 'Ten minutes of coffee before screens. No phone until after breakfast.',
                mood: 'Hopeful',
                userText:
                    "Setting the intention to not open my phone until after breakfast. Yesterday I managed it and the morning felt longer.",
            },
            {
                type: 'evening',
                daysBack: 0,
                title: 'Evening reflection',
                summary: 'Held the boundary most of the day. Reached for the phone once out of habit.',
                mood: 'Steady',
                userText:
                    "Reflected on the morning. I held the no-phone rule except one glance. Progress feels real.",
            },
            {
                type: 'morning',
                daysBack: 1,
                title: 'Morning intention',
                summary: 'Same calm-morning plan. Want to add a short stretch.',
                mood: 'Calm',
                userText: "Another slow morning intention. Adding a two-minute stretch before coffee.",
            },
        ],
        goals: [
            { title: 'No-phone morning block', type: 'habit', daysBack: 0 },
            { title: 'Two-minute morning stretch', type: 'habit', daysBack: 0 },
        ],
    },
    {
        title: 'Move my body three times a week',
        description: 'Run or walk at least three days a week to keep my mood steady.',
        area: 'wellbeing',
        iconKey: 'fitness',
        checkIns: [
            {
                type: 'evening',
                daysBack: 4,
                title: 'Evening reflection',
                summary: 'Completed the week-four run. Legs tired, mood lifted for hours after.',
                mood: 'Proud',
                userText:
                    "Logged my run. The post-movement clarity is the part I keep coming back for.",
            },
        ],
        goals: [
            { title: 'Week 4 run', type: 'goal', daysBack: 4 },
            { title: 'Movement three times a week', type: 'habit', daysBack: 4 },
        ],
    },
    {
        title: 'Speak the hurt, not the anger',
        description: 'In close relationships, name the feeling underneath before reacting.',
        area: 'romance',
        iconKey: 'heart',
        checkIns: [
            {
                type: 'evening',
                daysBack: 2,
                title: 'Evening reflection',
                summary: 'Noticed anger was covering hurt after the chores argument. Will try naming it.',
                mood: 'Tender',
                userText:
                    "Realized I was more hurt than angry. Next time I want to say the hurt part out loud.",
            },
        ],
        goals: [
            { title: 'Name the feeling under the anger', type: 'goal', daysBack: 2 },
        ],
    },
    {
        title: 'Grow into the new role',
        description: 'Track one small win each week to quiet comparison-driven self-doubt.',
        area: 'career',
        iconKey: 'briefcase',
        checkIns: [
            {
                type: 'intention',
                daysBack: 6,
                title: 'Set intention',
                summary: 'Weekly small-win note to counter the impostor hum.',
                mood: 'Curious',
                userText:
                    "Setting an intention to write one small win each Friday so I can see progress, not just gaps.",
            },
        ],
        goals: [
            { title: 'Write one small win each week', type: 'habit', daysBack: 6 },
        ],
    },
];

const MEMORY_NOTES: readonly string[] = [
    'User feels most grounded during slow, phone-free mornings.',
    'Movement (running or walking) is the user’s most reliable mood regulator.',
    'In conflict, the user tends to feel hurt underneath anger and wants to name it.',
];

async function atomsLinkedToSources(
    sourceIds: ReadonlySet<string>,
    context: AccountOperationContext,
): Promise<string[]> {
    const atoms = await listMemoryAtoms();
    assertAccountOperationActive(context);
    return atoms
        .filter((a) => a.rootSourceId && sourceIds.has(a.rootSourceId))
        .map((a) => a.id);
}

async function rebuildDayDigestsFromRemaining(context: AccountOperationContext): Promise<void> {
    await clearDayDigests();
    assertAccountOperationActive(context);
    const entries = await listEntries('completed');
    assertAccountOperationActive(context);
    for (const entry of entries) {
        await upsertJournalDayDigest(entry);
        assertAccountOperationActive(context);
    }
    const checkIns = await listCheckIns();
    assertAccountOperationActive(context);
    for (const c of checkIns) {
        if (c.status === 'completed') {
            await upsertCheckInDayDigest(c);
            assertAccountOperationActive(context);
        }
    }
}

/**
 * Remove only rows recorded in the seed ID ledger. Real user rows are never
 * matched by title/content — only by tracked IDs from a prior seed run.
 */
async function clearDemoDataForAccount(
    storage: AccountStorageAdapter,
    context: AccountOperationContext,
): Promise<boolean> {
    const record = await loadSeedRecord(storage, context);
    if (!record) {
        try {
            assertAccountOperationActive(context);
            await storage.removeItem(SEED_FLAG_KEY);
            assertAccountOperationActive(context);
            await storage.removeItem(DEMO_SEED_RECORD_KEY);
            assertAccountOperationActive(context);
        } catch (error) {
            if (context.signal.aborted) throw error;
            // ignore
        }
        return false;
    }

    for (const id of record.journalEntryIds) {
        try {
            assertAccountOperationActive(context);
            await deleteEntry(id);
            assertAccountOperationActive(context);
        } catch (error) {
            if (context.signal.aborted) throw error;
            // continue
        }
    }
    for (const id of record.checkInIds) {
        try {
            assertAccountOperationActive(context);
            await deleteCheckIn(id);
            assertAccountOperationActive(context);
        } catch (error) {
            if (context.signal.aborted) throw error;
            // continue
        }
    }
    for (const id of record.intentionIds) {
        try {
            assertAccountOperationActive(context);
            await deleteIntention(id);
            assertAccountOperationActive(context);
        } catch (error) {
            if (context.signal.aborted) throw error;
            // continue
        }
    }
    for (const id of record.goalIds) {
        try {
            assertAccountOperationActive(context);
            await deleteGoal(id);
            assertAccountOperationActive(context);
        } catch (error) {
            if (context.signal.aborted) throw error;
            // continue
        }
    }
    for (const id of record.memoryAtomIds) {
        try {
            assertAccountOperationActive(context);
            await deleteMemoryAtom(id);
            assertAccountOperationActive(context);
        } catch (error) {
            if (context.signal.aborted) throw error;
            // continue
        }
    }

    // Linked atoms created after seed via extraction may still reference seed sources.
    const sourceIds = new Set([...record.journalEntryIds, ...record.checkInIds]);
    assertAccountOperationActive(context);
    const leftover = await atomsLinkedToSources(sourceIds, context);
    for (const id of leftover) {
        try {
            assertAccountOperationActive(context);
            await deleteMemoryAtom(id);
            assertAccountOperationActive(context);
        } catch (error) {
            if (context.signal.aborted) throw error;
            // continue
        }
    }

    await rebuildDayDigestsFromRemaining(context);

    try {
        assertAccountOperationActive(context);
        await storage.removeItem(DEMO_SEED_RECORD_KEY);
        assertAccountOperationActive(context);
        await storage.removeItem(SEED_FLAG_KEY);
        assertAccountOperationActive(context);
    } catch (error) {
        if (context.signal.aborted) throw error;
        // ignore
    }
    return true;
}

export function clearDemoData(): Promise<boolean> {
    return runAccountBoundOperation('seed-clear', (context) => enqueueSeedOperation(() => (
        clearDemoDataForAccount(getStorageForAccount(context.accountId), context)
    )));
}

/**
 * Writes demo rows and records their IDs. Does NOT wipe real user data —
 * clears only a prior seed run first.
 */
async function seedDemoDataForAccount(
    storage: AccountStorageAdapter,
    context: AccountOperationContext,
): Promise<void> {
    await clearDemoDataForAccount(storage, context);
    assertAccountOperationActive(context);

    const record = emptyRecord();
    const sourceIds = new Set<string>();

    for (const seed of JOURNAL_SEED) {
        const createdAt = daysAgo(seed.daysBack);
        const idSeed = `j_${seed.daysBack}`;
        assertAccountOperationActive(context);
        const entry = await createEntry({
            title: seed.title,
            emoji: seed.emoji,
            status: 'completed',
            createdAt,
            updatedAt: createdAt,
            messages: [
                msg('user', seed.userText, createdAt, `${idSeed}_u`),
                msg('assistant', seed.assistantText, createdAt + 1000, `${idSeed}_a`),
            ],
            analysis: {
                ...seed.analysis,
                generatedAt: createdAt,
            },
        });
        assertAccountOperationActive(context);
        record.journalEntryIds.push(entry.id);
        sourceIds.add(entry.id);
        await saveJournalEntryMemories(entry);
        assertAccountOperationActive(context);
        await upsertJournalDayDigest(entry);
        await saveSeedRecord(record, storage, context); // incremental — clear must work even if later steps hang
    }

    for (const seed of INTENTION_SEED) {
        assertAccountOperationActive(context);
        const intention = await createIntention({
            title: seed.title,
            description: seed.description,
            area: seed.area,
            iconKey: seed.iconKey,
        });
        assertAccountOperationActive(context);
        record.intentionIds.push(intention.id);

        for (const checkIn of seed.checkIns) {
            const createdAt = daysAgo(checkIn.daysBack);
            const idSeed = `c_${seed.title}_${checkIn.daysBack}_${checkIn.type}`;
            assertAccountOperationActive(context);
            const saved = await createCheckIn({
                intentionId: intention.id,
                type: checkIn.type,
                title: checkIn.title,
                summary: checkIn.summary,
                mood: checkIn.mood,
                status: 'completed',
                createdAt,
                updatedAt: createdAt,
                messages: [msg('user', checkIn.userText, createdAt, idSeed)],
            });
            assertAccountOperationActive(context);
            // createCheckIn already saves memories + day digest for completed.
            record.checkInIds.push(saved.id);
            sourceIds.add(saved.id);

            const dateKey = dateKeyDaysAgo(checkIn.daysBack);
            assertAccountOperationActive(context);
            const g = await createGoal({
                title: `${seed.title} — ${checkIn.type} check-in`,
                type: 'goal',
                dateKey,
                intentionId: intention.id,
                createdAt,
                updatedAt: createdAt,
            });
            assertAccountOperationActive(context);
            record.goalIds.push(g.id);
            await saveSeedRecord(record, storage, context);
        }

        for (const goal of seed.goals) {
            const createdAt = daysAgo(goal.daysBack);
            const dateKey = dateKeyDaysAgo(goal.daysBack);
            if (goal.type === 'habit') {
                assertAccountOperationActive(context);
                const g = await createGoal({
                    title: goal.title,
                    type: 'habit',
                    dateKey,
                    intentionId: intention.id,
                    createdAt,
                    updatedAt: createdAt,
                });
                assertAccountOperationActive(context);
                record.goalIds.push(g.id);
            } else {
                assertAccountOperationActive(context);
                const goalItem = await createGoal({
                    title: goal.title,
                    type: 'goal',
                    dateKey,
                    intentionId: intention.id,
                    createdAt,
                    updatedAt: createdAt,
                });
                assertAccountOperationActive(context);
                await updateGoal(goalItem.id, { completed: true });
                assertAccountOperationActive(context);
                record.goalIds.push(goalItem.id);
            }
            await saveSeedRecord(record, storage, context);
        }
    }

    for (const note of MEMORY_NOTES) {
        assertAccountOperationActive(context);
        const atom = await saveManualMemoryNote(note);
        assertAccountOperationActive(context);
        record.memoryAtomIds.push(atom.id);
        await saveSeedRecord(record, storage, context);
    }
    assertAccountOperationActive(context);
    const generated = await saveGeneratedMemoryNote(
        'Recurring theme: the user returns to calm mornings, movement, and honest communication as what regulates them.'
    );
    assertAccountOperationActive(context);
    if (generated) {
        record.memoryAtomIds.push(generated.id);
    }

    // Capture atoms produced by journal/check-in memory pipelines.
    const linked = await atomsLinkedToSources(sourceIds, context);
    for (const id of linked) {
        if (!record.memoryAtomIds.includes(id)) {
            record.memoryAtomIds.push(id);
        }
    }

    await saveSeedRecord(record, storage, context);
}

export function seedDemoData(): Promise<void> {
    return runAccountBoundOperation('seed-demo', (context) => enqueueSeedOperation(() => (
        seedDemoDataForAccount(getStorageForAccount(context.accountId), context)
    )));
}

const BULK_TOPICS = ['work', 'sleep', 'family', 'exercise', 'food', 'mood'] as const;

/**
 * Inline bulk journal rows (no probes/ import — isolation forbids services → probes).
 * Deterministic titles/bodies for prompt-budget 365-entry runs.
 */
function buildBulkSeedRows(count: number): readonly {
    title: string;
    body: string;
    topic: string;
    daysBack: number;
}[] {
    const n = Math.max(1, Math.min(count, 400));
    const rows: { title: string; body: string; topic: string; daysBack: number }[] = [];
    for (let i = 0; i < n; i += 1) {
        const topic = BULK_TOPICS[i % BULK_TOPICS.length];
        const daysBack = Math.floor((i / Math.max(n - 1, 1)) * 396);
        rows.push({
            title: `Probe day ${i + 1}: ${topic}`,
            body:
                `Bulk seed entry ${i + 1} about ${topic}. `
                + `I wrote this to fill history for prompt-budget measurement. `
                + `Day offset ${daysBack}. The week has been uneven; noting it here.`,
            topic,
            daysBack,
        });
    }
    return rows;
}

/**
 * Dev-only bulk journal seed (~365).
 * Tracked IDs go through DEMO_SEED_RECORD_KEY so clearDemoData wipes them.
 * Digests written for rollups; atom extraction skipped for speed.
 */
async function seedBulkProbeJournalForAccount(
    options: { count?: number },
    storage: AccountStorageAdapter,
    context: AccountOperationContext,
): Promise<number> {
    const target = Math.max(1, options.count ?? 365);
    const probeEntries = buildBulkSeedRows(target);

    await clearDemoDataForAccount(storage, context);
    assertAccountOperationActive(context);
    const record = emptyRecord();

    for (let i = 0; i < probeEntries.length; i += 1) {
        const seed = probeEntries[i];
        const createdAt = daysAgo(seed.daysBack);
        const idSeed = `probe_${i}`;
        assertAccountOperationActive(context);
        const entry = await createEntry({
            title: seed.title,
            emoji: '📓',
            status: 'completed',
            createdAt,
            updatedAt: createdAt,
            messages: [
                msg('user', seed.body, createdAt, `${idSeed}_u`),
                msg(
                    'assistant',
                    `I hear you about ${seed.topic}. Thanks for writing this down.`,
                    createdAt + 1000,
                    `${idSeed}_a`,
                ),
            ],
            analysis: {
                insight: seed.body.slice(0, 180),
                quote: seed.body.slice(0, 80),
                mood: seed.topic,
                topics: [seed.topic],
                generatedAt: createdAt,
            },
        });
        assertAccountOperationActive(context);
        record.journalEntryIds.push(entry.id);
        await upsertJournalDayDigest(entry);
        assertAccountOperationActive(context);
        if (i % 25 === 0 || i === probeEntries.length - 1) {
            await saveSeedRecord(record, storage, context);
        }
    }

    await saveSeedRecord(record, storage, context);
    return record.journalEntryIds.length;
}

export function seedBulkProbeJournal(options: { count?: number } = {}): Promise<number> {
    if (!isDemoSeedEnabled()) {
        return Promise.reject(new Error('Bulk probe seed is only available in __DEV__'));
    }
    return runAccountBoundOperation('seed-bulk', (context) => enqueueSeedOperation(() => (
        seedBulkProbeJournalForAccount(options, getStorageForAccount(context.accountId), context)
    )));
}

/** Prevent concurrent first-launch seeds (layout re-mount / double effect). */

/**
 * Auto-seed on first launch — **dev only**. Production is a no-op.
 */
export function seedDemoDataIfFirstLaunch(): Promise<boolean> {
    if (!isDemoSeedEnabled()) {
        return Promise.resolve(false);
    }

    const accountId = getActiveAccountId();
    if (seedInFlight) {
        return seedInFlight.accountId === accountId
            ? seedInFlight.promise
            : Promise.resolve(false);
    }

    const promise = runAccountBoundOperation('seed-first-launch', (context) => (
        enqueueSeedOperation(async () => {
            const storage = getStorageForAccount(context.accountId);
            try {
                assertAccountOperationActive(context);
                const alreadyFlagged = await storage.getItem(SEED_FLAG_KEY);
                assertAccountOperationActive(context);
                if (alreadyFlagged === 'true') {
                    return false;
                }
                const existingRecord = await loadSeedRecord(storage, context);
                if (existingRecord) {
                    return false;
                }

                const [existingEntries, existingIntentions, existingGoals] = await Promise.all([
                    listEntries(),
                    listIntentions(),
                    listGoals(),
                ]);
                assertAccountOperationActive(context);

                const hasExistingData =
                    existingEntries.length > 0
                    || existingIntentions.length > 0
                    || existingGoals.length > 0;

                if (hasExistingData) {
                    // Do not set SEED_FLAG alone without a record — that blocks clear.
                    return false;
                }

                await seedDemoDataForAccount(storage, context);
                assertAccountOperationActive(context);
                return true;
            } catch (error) {
                if (context.signal.aborted) throw error;
                console.warn('[seed] seedDemoDataIfFirstLaunch failed:', error);
                return false;
            }
        })
    ));
    const tracked = { accountId, promise };
    seedInFlight = tracked;
    promise.then(
        () => {
            if (seedInFlight === tracked) seedInFlight = null;
        },
        () => {
            if (seedInFlight === tracked) seedInFlight = null;
        },
    );
    return promise;
}
