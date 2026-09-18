/**
 * Supersession pricing scenario — deliberately SEPARATE from the R0 ledger.
 *
 * The R0 ledger cannot price supersession: its distractors are distinct entries
 * with templated headers, which is exactly what supersession must refuse (it
 * reports zero there by design). Adding restatement pairs to that ledger would
 * also perturb the frozen probe set — a 48th file changes the recency fallback
 * selection, the `tmpRemaining` count and the thread shortlist, so every R0/R1/R2
 * number would stop being comparable.
 *
 * So this scenario is its own store with its own probes:
 *
 *   - `desk_setup` holds a real restatement pair — the same memory captured
 *     twice, the newer one a superset of the older. Supersession must collapse it.
 *   - `training_log` is the control — two genuinely different memories that share
 *     vocabulary and sentence shape. Supersession must leave both alone. Without
 *     this control, "supersession fired" would be indistinguishable from
 *     "supersession over-fires".
 *
 * Seeded *unstaged* (`stageTmpMemory` with an explicit projectId), so the files
 * land in their formal threads with no Dream pass. That is what makes the A/B
 * honest: the before-state is post-promotion / pre-supersession, and the only
 * thing that changes between the two measurements is the supersession pass.
 */

import {
    listFormalProjectIds,
    stageTmpMemory,
} from '../../services/memory/memoryFiles';

export const RESTATEMENT_THREAD_ID = 'desk_setup';
export const CONTROL_THREAD_ID = 'training_log';

export type RestatementRole = 'stale' | 'current' | 'control-old' | 'control-new' | 'filler';

export interface RestatementFile {
    readonly role: RestatementRole;
    readonly projectId: string;
    readonly name: string;
    readonly description: string;
    readonly body: string;
    /** Pinned capture date — the newest member of a thread is the survivor. */
    readonly capturedAt: string;
}

function at(day: number, hour = 9): string {
    return new Date(Date.UTC(2026, 8, day, hour, 0, 0)).toISOString();
}

/**
 * Bodies carry 20+ tokens on purpose: supersession refuses to judge shorter
 * bodies (`SUPERSEDE_MIN_BODY_TOKENS`), so a short control would pass for the
 * wrong reason.
 */
export const RESTATEMENT_FILES: readonly RestatementFile[] = [
    // --- the restatement pair: `current` contains every token `stale` has ---
    {
        role: 'stale',
        projectId: RESTATEMENT_THREAD_ID,
        name: 'Writing desk setup',
        description: 'Desk setup: lamp, notebook tray, and wool mat.',
        body: '## Current Stage\nThe writing desk sits by the north window. A brass lamp stands on the left corner, '
            + 'the notebook tray is centred under the shelf, and a wool mat covers the keyboard area. '
            + 'Nothing else lives on the surface.',
        capturedAt: at(1),
    },
    {
        role: 'current',
        projectId: RESTATEMENT_THREAD_ID,
        name: 'Writing desk setup, current',
        description: 'Desk setup: lamp, notebook tray, wool mat, and the warmer bulb.',
        body: '## Current Stage\nThe writing desk sits by the north window. A brass lamp stands on the left corner, '
            + 'the notebook tray is centred under the shelf, and a wool mat covers the keyboard area. '
            + 'Nothing else lives on the surface. The lamp bulb was swapped for a warmer one last week.',
        capturedAt: at(8),
    },

    // --- the control: shared vocabulary and shape, different memories ---
    {
        role: 'control-old',
        projectId: CONTROL_THREAD_ID,
        name: 'Sunday long run',
        description: 'Training log: the Sunday long run along the river.',
        body: '## Current Stage\nThe Sunday long run covered eighteen kilometres along the river path at an easy pace. '
            + 'Legs felt heavy for the final three kilometres but recovered quickly afterwards.',
        capturedAt: at(2),
    },
    {
        role: 'control-new',
        projectId: CONTROL_THREAD_ID,
        name: 'Midweek intervals',
        description: 'Training log: the midweek interval session on the track.',
        body: '## Current Stage\nThe midweek interval session covered eight hundred metre repeats on the track at a hard pace. '
            + 'Legs felt heavy through the final two repeats but the splits held steady.',
        capturedAt: at(3),
    },

    // --- filler threads: give the thread shortlist something to discriminate ---
    {
        role: 'filler',
        projectId: 'garden_log',
        name: 'Tomato bed',
        description: 'Garden log: the tomato bed and its watering routine.',
        body: '## Current Stage\nThe tomato bed holds six plants against the south fence. Watering happens every second '
            + 'morning before work, and the mulch keeps the soil damp through the hottest part of the day.',
        capturedAt: at(4),
    },
    {
        role: 'filler',
        projectId: 'garden_log',
        name: 'Herb pots',
        description: 'Garden log: the herb pots on the back step.',
        body: '## Current Stage\nThe herb pots on the back step hold basil, parsley, and mint. The mint keeps trying to '
            + 'escape its container, so it gets trimmed whenever the leaves start shading the parsley.',
        capturedAt: at(5),
    },
    {
        role: 'filler',
        projectId: 'reading_log',
        name: 'Winter reading',
        description: 'Reading log: the winter stack and where it lives.',
        body: '## Current Stage\nThe winter stack sits beside the armchair: two novels, a book of essays, and a slim '
            + 'volume about cartography. Reading happens mostly in the evening once the house goes quiet.',
        capturedAt: at(6),
    },
    {
        role: 'filler',
        projectId: 'reading_log',
        name: 'Library holds',
        description: 'Reading log: holds placed at the branch library.',
        body: '## Current Stage\nThree holds are waiting at the branch library. The pickup window is a full week, so '
            + 'collecting them means a deliberate trip rather than a detour on the way home.',
        capturedAt: at(7),
    },
];

export interface RestatementProbe {
    readonly id: string;
    readonly intent: string;
    readonly question: string;
    readonly projectId: string;
    /** The file a correct recall must surface. */
    readonly expectRole: RestatementRole;
    /** The file supersession should have removed from recall, if any. */
    readonly staleRole: RestatementRole | null;
}

/**
 * Fixed probe set for this scenario. `restated-topic` is the one supersession
 * has to improve; `control-topic` is the one it must not damage.
 */
export const RESTATEMENT_PROBES: readonly RestatementProbe[] = [
    {
        id: 'restated-topic',
        intent: 'After supersession the stale copy must leave recall and the survivor must still answer.',
        question: 'How is my writing desk set up?',
        projectId: RESTATEMENT_THREAD_ID,
        expectRole: 'current',
        staleRole: 'stale',
    },
    {
        id: 'control-topic',
        intent: 'A thread with two distinct memories must keep both — supersession must not over-fire.',
        question: 'How is my training log looking?',
        projectId: CONTROL_THREAD_ID,
        expectRole: 'control-new',
        staleRole: null,
    },
];

/**
 * Formal thread id Dream produces from a scenario project id when the scenario
 * is seeded staged: the thread hint is slugified, so `desk_setup` becomes
 * `desk-setup`. Exported so tests do not have to hardcode the transformation.
 */
export function stagedThreadId(projectId: string): string {
    return projectId.replace(/_/g, '-');
}

export interface SeededRestatementScenario {
    readonly files: readonly RestatementFile[];
    readonly idsByRole: Record<string, string>;
    readonly formalThreadIds: readonly string[];
}

/**
 * Seed the scenario into whatever memory-file storage adapter is installed.
 *
 * `staged: true` reproduces the real path instead: every file lands in `_tmp`
 * behind a thread hint, so a Dream pass has to promote them before supersession
 * can see them. That is how the wiring test proves the pass actually rides
 * Dream's trigger.
 */
export async function seedRestatementScenario(
    options: { staged?: boolean } = {},
): Promise<SeededRestatementScenario> {
    const idsByRole: Record<string, string> = {};
    for (const file of RESTATEMENT_FILES) {
        const staged = await stageTmpMemory({
            type: 'project',
            name: file.name,
            description: options.staged
                ? `Thread hint ${stagedThreadId(file.projectId)}. ${file.description}`
                : file.description,
            body: file.body,
            projectId: options.staged ? undefined : file.projectId,
            capturedAt: file.capturedAt,
        });
        idsByRole[file.role] = staged.id;
    }
    return {
        files: RESTATEMENT_FILES,
        idsByRole,
        formalThreadIds: await listFormalProjectIds(),
    };
}
