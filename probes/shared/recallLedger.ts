/**
 * R0 seeded fixture ledger — the offline memory store used by the recall
 * measurement harness, its planted needles, and the fixed probe set.
 *
 * Deterministic: the corpus comes from the seeded E2/E3/E5 journal fixture
 * (`./fixture`), and memory-file ids are content-hashed by the real store, so
 * reruns reproduce the same ledger. No product behaviour lives here — R0 only
 * measures.
 */

import {
    buildProbeFixture,
    SEMANTIC_NEEDLE_TOKEN,
    type ProbeJournalEntry,
} from './fixture';

import {
    importMemoryFiles,
    listFormalProjectIds,
    listMemoryFiles,
    stageTmpMemory,
    type MemoryFileImportRecord,
} from '../../services/memory/memoryFiles';

/** Distinctive token planted inside the thread needle (never invented by a model). */
export const RECALL_NEEDLE_TOKEN = SEMANTIC_NEEDLE_TOKEN;

/** Formal thread that owns the needle + its near-topic distractors. */
export const NEEDLE_PROJECT_ID = 'fountain_pens';
/** Thread holding a needle with NO distinctive vocabulary (list-only reachable). */
export const LIST_ONLY_PROJECT_ID = 'early_journal';
/** Identity file — always-on user memory (recall route `user`). */
export const USER_FILE_ID = 'memory/User/profile.md';

export type RecallFileRole = 'needle' | 'list-only-needle' | 'distractor' | 'filler' | 'user';

/**
 * Pinned capture dates. Backlog order (`listTmpFiles`), fade recency and
 * supersession ordering all read `capturedAt`, so a fixture that inherited the
 * wall clock would make Dream's promotion slice — and therefore every metric
 * downstream of it — differ between runs. Offsets preserve the fixture's own
 * sequence, so the ordering still means something.
 */
const LEDGER_CAPTURE_BASE_MS = Date.parse('2026-09-01T09:00:00.000Z');
const LEDGER_CAPTURE_STEP_MS = 60_000;

/** Capture date for the nth fixture file, newest last. */
export function ledgerCapturedAt(index: number): string {
    return new Date(LEDGER_CAPTURE_BASE_MS + index * LEDGER_CAPTURE_STEP_MS).toISOString();
}

/**
 * The profile is maintained, so it is the most current statement in the store —
 * pin it past every fixture file rather than letting it ride the wall clock,
 * which is what used to make it float to the top of recency ordering.
 */
const LEDGER_USER_CAPTURED_AT = new Date(
    LEDGER_CAPTURE_BASE_MS + 100 * LEDGER_CAPTURE_STEP_MS,
).toISOString();

export interface RecallLedgerFile {
    readonly role: RecallFileRole;
    readonly projectId: string;
    readonly name: string;
    readonly description: string;
    readonly body: string;
    /** Filled in by seeding — the store assigns content-hashed ids. */
    id?: string;
    relativePath?: string;
}

/** Filler threads keep the manifest realistic without touching the needle threads. */
const FILLER_THREADS: { projectId: string; topic: string; label: string }[] = [
    { projectId: 'work', topic: 'work', label: 'Workload' },
    { projectId: 'family', topic: 'family', label: 'Family logistics' },
    { projectId: 'marathon_training', topic: 'exercise', label: 'Marathon training' },
    { projectId: 'sleep', topic: 'sleep', label: 'Sleep debt' },
    { projectId: 'finances', topic: 'finance', label: 'Money baseline' },
    { projectId: 'anxiety_loop', topic: 'anxiety', label: 'Overthinking loop' },
];

const FILLER_FILES_PER_THREAD = 5;
const DISTRACTOR_COUNT = 15;

function firstEntries(
    entries: readonly ProbeJournalEntry[],
    topic: string,
    count: number,
): ProbeJournalEntry[] {
    return entries.filter((e) => e.topic === topic).slice(0, count);
}

/**
 * Build the ledger as plain files. Ids are assigned by `seedRecallLedger`.
 */
export function buildRecallLedgerFiles(): RecallLedgerFile[] {
    const fixture = buildProbeFixture();
    const files: RecallLedgerFile[] = [];

    const needleEntry = fixture.entries.find((e) => e.isSemanticNeedle);
    const listOnlyEntry = fixture.entries.find((e) => e.isListOnlyNeedle);
    if (!needleEntry || !listOnlyEntry) {
        throw new Error('fixture is missing its planted needles');
    }

    // 1. The thread needle — distinctive token lives in the body.
    files.push({
        role: 'needle',
        projectId: NEEDLE_PROJECT_ID,
        name: 'Cataloguing the fountain pens',
        description:
            'Notes on cataloguing vintage fountain pens, the flex nib, and my private catalog code for the rarest piece.',
        body: needleEntry.body,
    });

    // 2. Near-topic distractors in the SAME thread — same vocabulary, no token.
    const distractors = fixture.entries.filter((e) => e.isNearTopicDistractor).slice(0, DISTRACTOR_COUNT);
    distractors.forEach((entry, index) => {
        files.push({
            role: 'distractor',
            projectId: NEEDLE_PROJECT_ID,
            name: `Desk notes ${index + 1}`,
            description: `Fountain pen and ink notes about ${entry.title.toLowerCase()}, stationery, and nibs.`,
            body: entry.body,
        });
    });

    // 3. List-only needle — generic prose, reachable only by browsing, not by matching.
    files.push({
        role: 'list-only-needle',
        projectId: LIST_ONLY_PROJECT_ID,
        name: 'Where the journal started',
        description: 'The first entries, written before the journal had any shape.',
        body: listOnlyEntry.body,
    });

    // 4. Filler threads — volume so the manifest scan has to discriminate.
    for (const thread of FILLER_THREADS) {
        firstEntries(fixture.entries, thread.topic, FILLER_FILES_PER_THREAD).forEach((entry, index) => {
            files.push({
                role: 'filler',
                projectId: thread.projectId,
                name: `${thread.label} note ${index + 1}`,
                description: `${thread.label}: ${entry.title}.`,
                body: entry.body,
            });
        });
    }

    return files;
}

export interface SeededRecallLedger {
    readonly files: readonly RecallLedgerFile[];
    readonly seedMs: number;
    readonly needleIds: readonly string[];
    readonly distractorIds: readonly string[];
    readonly listOnlyIds: readonly string[];
    readonly userIds: readonly string[];
    readonly formalThreadIds: readonly string[];
}

/** Identity file — user type/global scope, so it must go through bulk import. */
export function buildUserFile(): MemoryFileImportRecord {
    const timestamp = LEDGER_USER_CAPTURED_AT;
    return {
        header: {
            id: USER_FILE_ID,
            relativePath: USER_FILE_ID,
            name: 'Profile',
            description: 'Name, pronouns, and durable facts about the user.',
            type: 'user',
            scope: 'global',
            updatedAt: timestamp,
            capturedAt: timestamp,
        },
        content:
            '## Profile\nName: Sig\nPronouns: he/him\n\n## Preferences\n- Prefers short, concrete answers.\n- Writes most evenings.',
    };
}

/**
 * Real finish-path shape (`memoryStage.ts`): `Thread hint <hint>. <excerpt>`.
 * Dream's offline clustering groups staged files by this hint.
 */
export function threadHintFor(projectId: string): string {
    return projectId.replace(/_/g, '-');
}

/**
 * Seed the ledger into whatever memory-file storage adapter is installed.
 * Uses the real staging API for thread files (no test-only writer).
 *
 * `staged: true` reproduces a fresh device: every file lands in `_tmp` with the
 * finish path's thread-hint description, so nothing is a formal thread until
 * Dream promotes it.
 */
export async function seedRecallLedger(
    options: { staged?: boolean } = {},
): Promise<SeededRecallLedger> {
    const started = Date.now();
    const files = buildRecallLedgerFiles();
    const seeded: RecallLedgerFile[] = [];

    for (const [index, file] of files.entries()) {
        const staged = await stageTmpMemory({
            type: file.role === 'distractor' || file.role === 'filler' ? 'feedback' : 'project',
            name: file.name,
            description: options.staged
                ? `Thread hint ${threadHintFor(file.projectId)}. ${file.description}`
                : file.description,
            body: file.body,
            projectId: options.staged ? undefined : file.projectId,
            capturedAt: ledgerCapturedAt(index),
        });
        seeded.push({ ...file, id: staged.id, relativePath: staged.relativePath });
    }

    const userFile = buildUserFile();
    const importResult = await importMemoryFiles([userFile]);
    if (importResult.imported !== 1) {
        throw new Error(`user memory file was not imported (skipped=${importResult.skipped})`);
    }

    const idsByRole = (role: RecallFileRole) => seeded.filter((f) => f.role === role).map((f) => f.id!);

    return {
        files: seeded,
        seedMs: Date.now() - started,
        needleIds: idsByRole('needle'),
        distractorIds: idsByRole('distractor'),
        listOnlyIds: idsByRole('list-only-needle'),
        userIds: [USER_FILE_ID],
        // Read back from the store, not from the fixture: in staged mode nothing
        // is a formal thread until Dream promotes it.
        formalThreadIds: await listFormalProjectIds(),
    };
}

/**
 * Re-anchor a ledger's expectations to the live store by file name.
 *
 * Dream promotion rewrites ids (`_tmp` → formal thread), so an id captured at
 * seed time stops identifying the same memory. Matching on name keeps the
 * before/after comparison about the memory, not about its first id.
 */
export async function resolveLedgerIdsByName(
    ledger: SeededRecallLedger,
): Promise<SeededRecallLedger> {
    const headers = [];
    for (let offset = 0; ; offset += 50) {
        const page = await listMemoryFiles({ limit: 50, offset });
        headers.push(...page);
        if (page.length < 50) break;
    }
    const byName = new Map<string, string>();
    headers.forEach((header) => {
        if (!byName.has(header.name)) byName.set(header.name, header.id);
    });
    const remap = (ids: readonly string[]): string[] =>
        ids.map((id) => {
            const file = ledger.files.find((f) => f.id === id);
            return (file && byName.get(file.name)) || id;
        });
    return {
        ...ledger,
        files: ledger.files.map((file) => ({ ...file, id: byName.get(file.name) ?? file.id })),
        needleIds: remap(ledger.needleIds),
        distractorIds: remap(ledger.distractorIds),
        listOnlyIds: remap(ledger.listOnlyIds),
    };
}

export interface RecallProbe {
    readonly id: string;
    /** What the probe is trying to falsify — recorded in the artifact. */
    readonly intent: string;
    readonly question: string;
    /** Drives a live agent turn (needs PROBE_LLM=1); deterministic otherwise. */
    readonly live?: boolean;
    /** Expected recall route, or null when the probe expects the gate to skip. */
    readonly expectRoute: 'none' | 'user' | 'project_memory' | null;
    /** Ledger roles that a correct recall has to surface. */
    readonly expectedRoles: readonly RecallFileRole[];
    /** Narrows the expectation to one thread (the pool for `expectedRoles`). */
    readonly expectProjectId?: string;
    /**
     * Literal facts a grounded live reply has to carry. Defaults to the planted
     * needle token; identity probes use the name/pronoun facts instead.
     */
    readonly expectedFacts?: readonly string[];
    /** True when the probe exists to measure distractor contamination. */
    readonly precisionProbe?: boolean;
}

/** Fixed probe set. Never tuned after a run — the baseline records what happens. */
export const RECALL_PROBES: readonly RecallProbe[] = [
    {
        id: 'needle-thread',
        intent: 'A thread query must surface the thread needle and plant its token in context.',
        question: 'What did I write about cataloguing the fountain pens?',
        live: true,
        expectRoute: 'project_memory',
        expectedRoles: ['needle'],
    },
    {
        id: 'needle-echo',
        intent: 'The model must quote the planted token verbatim when asked to search.',
        question:
            'Do you remember the private catalog code I invented for my rarest pen? Search your offline memory and quote it exactly.',
        live: true,
        expectRoute: 'project_memory',
        expectedRoles: ['needle'],
    },
    {
        id: 'precision-topical',
        intent: 'Topical overlap must not flood recall with distractors that lack the token.',
        question: 'Any notes about pens and ink lately?',
        expectRoute: 'project_memory',
        expectedRoles: ['needle'],
        precisionProbe: true,
    },
    {
        id: 'needle-list-only',
        intent: 'A needle with no distinctive vocabulary is reachable only by listing, not matching.',
        question: 'What did I write at the very beginning of my journal?',
        expectRoute: 'project_memory',
        expectedRoles: ['list-only-needle'],
    },
    {
        id: 'gate-smalltalk',
        intent: 'Greetings must short-circuit to zero memory injection (context budget guard).',
        question: 'hi',
        expectRoute: 'none',
        expectedRoles: [],
    },
    {
        id: 'route-user',
        intent: 'Identity questions must reach the always-on user file.',
        question: 'What is my name and what pronouns should you use?',
        live: true,
        expectRoute: 'user',
        expectedRoles: ['user'],
        // Facts stored in the always-on user file (buildUserFile).
        expectedFacts: ['Sig', 'he/him'],
    },
    {
        id: 'control-other-thread',
        intent: 'A different thread must not drag the needle thread in with it.',
        question: 'How is the marathon training going?',
        expectRoute: 'project_memory',
        expectedRoles: ['filler'],
        expectProjectId: 'marathon_training',
    },
];
