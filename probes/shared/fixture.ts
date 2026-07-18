/**
 * Shared 365-entry synthetic journal fixture for E2/E3/E5.
 * Seeded RNG + FIXED reference date → identical across reruns.
 */

/** Deterministic seed for fixture generation (reruns reproduce identically). */
export const FIXTURE_RNG_SEED = 0x5137_a813;
/** Fixed "today" for the probe universe — never Date.now(). */
export const REFERENCE_DATE_ISO = '2026-07-17';
export const SEMANTIC_NEEDLE_TOKEN = 'zephyr-quill-8137';
export const ENTRY_COUNT = 365;
/** ~11 months before reference ≈ 2025-08-17 */
export const SEMANTIC_NEEDLE_TARGET_ISO = '2025-08-17';

export interface ProbeJournalEntry {
    readonly id: string;
    readonly dateISO: string;
    readonly title: string;
    readonly body: string;
    readonly topic: string;
    readonly wordCount: number;
    readonly isSemanticNeedle: boolean;
    readonly isListOnlyNeedle: boolean;
    readonly isNearTopicDistractor: boolean;
}

/** Mulberry32 — deterministic, seedable. */
export function mulberry32(seed: number): () => number {
    let t = seed >>> 0;
    return () => {
        t += 0x6d2b79f5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

function pad2(n: number): string {
    return n < 10 ? `0${n}` : String(n);
}

/** Local calendar arithmetic without timezone surprises. */
export function addDaysIso(iso: string, deltaDays: number): string {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + deltaDays);
    return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

export function daysBetween(fromIso: string, toIso: string): number {
    const [y1, m1, d1] = fromIso.split('-').map(Number);
    const [y2, m2, d2] = toIso.split('-').map(Number);
    const a = Date.UTC(y1, m1 - 1, d1);
    const b = Date.UTC(y2, m2 - 1, d2);
    return Math.round((b - a) / 86_400_000);
}

const TOPICS = [
    { id: 'work', titles: ['Deadlines', 'Meeting hangover', 'Inbox zero fantasy'], seeds: [
        'The project timeline slipped again and I spent the afternoon rewriting status updates nobody will read carefully.',
        'I sat through three back-to-back calls and left with more questions than answers about ownership.',
        'My manager asked for a "quick summary" that turned into a two-hour deep dive into edge cases.',
    ]},
    { id: 'sleep', titles: ['Restless night', 'Sleep debt', 'Early wake'], seeds: [
        'I woke at 3am with my mind replaying conversations. The rest of the night was shallow and restless.',
        'Went to bed early for once, but still felt foggy by mid-morning. Coffee only partially helped.',
        'Dreams were vivid and slightly unsettling. I cannot remember details, only the residual tension.',
    ]},
    { id: 'family', titles: ['Call with sister', 'Family dinner', 'Mom update'], seeds: [
        'Talked with my sister about mom. We both tried to stay practical but the worry sat under every sentence.',
        'Sunday dinner was warmer than I expected. Old jokes resurfaced and for a while everything felt lighter.',
        'A short check-in with my parents turned into logistics about appointments and who will drive next week.',
    ]},
    { id: 'exercise', titles: ['Morning run', 'Gym half-effort', 'Walk to think'], seeds: [
        'Ran longer than planned. The first kilometer felt heavy; by the end my head finally quieted.',
        'I almost skipped the gym, then went for twenty minutes and left less irritated than I arrived.',
        'A long walk with no podcast. Noticing trees and traffic felt like reclaiming attention.',
    ]},
    { id: 'food', titles: ['Kitchen experiment', 'Takeout regret', 'Simple pasta'], seeds: [
        'Tried a new spice blend on roasted vegetables. Too much cumin, but salvageable with lemon.',
        'Ordered takeout after a long day. It was fine, which somehow made the evening feel emptier.',
        'Made a simple tomato pasta with garlic and basil. Comfort food without the performance of cooking.',
    ]},
    { id: 'finance', titles: ['Budget review', 'Subscription audit', 'Payday thoughts'], seeds: [
        'Looked at the spreadsheet and felt the familiar tightness. Nothing catastrophic, just chronic leak.',
        'Cancelled two subscriptions I had forgotten about. Small win, oddly satisfying.',
        'Payday arrived and left just as quickly. I need a clearer rule for fun money vs buffer.',
    ]},
    { id: 'anxiety', titles: ['Spiral notes', 'Body check-in', 'Overthinking loop'], seeds: [
        'Anxiety showed up as a tight chest before the meeting. Naming it helped a little; breathing helped more.',
        'I caught myself inventing futures that have not happened. Wrote three facts I actually know.',
        'The loop was familiar: one ambiguous message, then twenty interpretations, then shame about the twenty.',
    ]},
    { id: 'friends', titles: ['Coffee with Maya', 'Group chat', 'Cancelled plans'], seeds: [
        'Coffee with Maya ran long in the best way. We covered work, pets, and the weird middle of adulthood.',
        'The group chat exploded over weekend plans. I typed three drafts and sent the least clever one.',
        'Cancelled plans guilt is real. I needed the quiet more than the outing, and I am practicing saying that.',
    ]},
    { id: 'hobbies', titles: ['Reading night', 'Half-finished project', 'Music rabbit hole'], seeds: [
        'Read two chapters and underlined more than I should. The protagonist is annoying in a useful way.',
        'Opened the half-finished project, moved three pieces, closed it. Progress counts even when tiny.',
        'Fell into a music rabbit hole from a song I had not heard since college. Time bent a little.',
    ]},
    { id: 'weather', titles: ['Rain day', 'Heat wave', 'Gray morning'], seeds: [
        'Rain all afternoon. I stayed inside and watched the window turn into a soft gray painting.',
        'Heat made everyone short-tempered, including me. Evening air finally dropped a few degrees.',
        'Gray morning matched my mood. Not sad exactly — low battery, waiting for a charge.',
    ]},
] as const;

const FILLER_CLAUSES = [
    'I keep noticing how small choices stack into a tone for the whole day.',
    'There is a part of me that wants a clean narrative and another that knows life is messier.',
    'I am trying to write without editing myself into a performance of wellness.',
    'If I am honest, I am more tired than I admit in conversation.',
    'Nothing dramatic happened, and somehow that is what makes it worth recording.',
    'I wonder what I will think of this entry in six months.',
    'The day felt ordinary until I slowed down enough to name the undercurrent.',
    'I am practicing being kinder in the retelling, not just accurate.',
    'There was a moment of unexpected ease between tasks that I almost missed.',
    'I left a few things unfinished on purpose so tomorrow has a softer landing.',
];

function pick<T>(rng: () => number, arr: readonly T[]): T {
    return arr[Math.floor(rng() * arr.length)]!;
}

function expandBody(rng: () => number, seed: string, minWords: number, maxWords: number): string {
    const target = minWords + Math.floor(rng() * (maxWords - minWords + 1));
    const parts: string[] = [seed];
    while (wordCount(parts.join(' ')) < target) {
        parts.push(pick(rng, FILLER_CLAUSES));
        if (rng() > 0.55) {
            parts.push(
                `Around midday I noticed ${pick(rng, [
                    'my shoulders were up near my ears',
                    'I was doom-scrolling without realizing',
                    'I had not drunk enough water',
                    'a song stuck on loop in my head',
                    'I was avoiding a simple email',
                ])}.`,
            );
        }
        if (rng() > 0.6) {
            parts.push(
                `Later I ${pick(rng, [
                    'wrote a short list of what actually matters this week',
                    'texted someone I care about without overthinking the draft',
                    'stepped outside for five minutes of air',
                    'closed the laptop and let the room be quiet',
                    'made tea and sat with the discomfort instead of fixing it',
                ])}.`,
            );
        }
    }
    let text = parts.join(' ');
    const words = text.split(/\s+/);
    if (words.length > maxWords) text = words.slice(0, maxWords).join(' ');
    return text;
}

function wordCount(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
}

function buildSemanticNeedleBody(): string {
    return [
        'I spent the evening sorting a small box of vintage fountain pens I inherited.',
        'One barrel still held a dried dark blue, and the nib had a distinctive flex that felt almost musical on paper.',
        'While labeling the box I invented a catalog code for the rarest piece:',
        `${SEMANTIC_NEEDLE_TOKEN}.`,
        'It is not a commercial SKU — just my private mnemonic for the quill-etched cap with the zephyr-blue enamel band.',
        'I wrote a paragraph about why tactile writing still calms me when screens make thoughts too fast.',
        'The smell of old ink, the weight of brass, the patience of waiting for a line to dry — all of it felt like permission to be slow.',
        'I am not starting a collection as a project with goals; I am keeping a few objects that make language feel physical again.',
        'If I ever misplace the pen, that code is how I will know it is mine.',
        FILLER_CLAUSES[0],
        FILLER_CLAUSES[5],
        'Tomorrow I might photograph the nib under good light, but tonight I only wanted the sound of paper.',
    ].join(' ');
}

function buildNearTopicBody(rng: () => number, index: number): string {
    const variants = [
        'Browsed fountain pen forums without buying anything. The nib material debates are endless and oddly soothing.',
        'Tried journaling with a cheap rollerball after thinking about nicer pens. The words still came; the romance did not.',
        'Cleaned a clogged nib with a mild solution. Patience required. Ink ran clear after the third rinse.',
        'Watched a calligraphy demo online. My hand cramps just imagining those flourishes, but the discipline appeals.',
        'Organized desk drawers and found three dry markers and one half-full bottle of blue-black ink.',
        'Wrote a letter by hand for the first time in months. Slower than email, and that was the point.',
        'Read about paper tooth and feathering. Realized my notebook is too smooth for wet inks.',
        'Considered converting an old dip pen into a decoration. Decided objects can stay useful without becoming projects.',
        'Sketched a logo idea with a fine liner. Not related to pens exactly, but the line quality made me think of nibs.',
        'A coworker mentioned bullet journaling with fancy stationery. I nodded and privately preferred plain ruled pages.',
        'Compared EF and F nib widths in a product page rabbit hole. Closed the tab before carting anything.',
        'Recalled learning cursive in school and how my signature still looks like a weather system.',
        'Put a blotter pad under tonight\'s page. Felt theatrical and slightly delightful.',
        'Thought about the difference between collecting and hoarding tools for creativity I rarely use.',
        'Left a short note in the margin about wanting a quieter writing practice, no gear required tomorrow.',
    ];
    const base = variants[index % variants.length]!;
    return expandBody(rng, base, 100, 220);
}

function buildListOnlyNeedleBody(): string {
    // Deliberately generic — no unique tokens; findable by pagination only.
    return [
        'First day trying this journal thing.',
        'Not sure what to write yet.',
        'The day was fine overall.',
        'Work was normal, dinner was simple, and I went to bed on time.',
        'I guess I will see if writing helps me notice patterns later.',
        'Nothing special to report, just starting.',
        FILLER_CLAUSES[4],
        FILLER_CLAUSES[6],
        'Maybe tomorrow I will have more to say. For now this is enough.',
        'I am keeping this short on purpose.',
    ].join(' ');
}

export interface ProbeFixture {
    readonly referenceDateISO: string;
    readonly entries: readonly ProbeJournalEntry[];
    readonly semanticNeedleId: string;
    readonly listOnlyNeedleId: string;
    readonly nearTopicDistractorIds: readonly string[];
    readonly oldestId: string;
    readonly newestId: string;
}

let cached: ProbeFixture | null = null;

export function buildProbeFixture(): ProbeFixture {
    if (cached) return cached;
    const rng = mulberry32(FIXTURE_RNG_SEED);
    // 13 months before reference ≈ 396 days; spread 365 entries across that span.
    const spanDays = Math.round(13 * 30.44); // ~396
    const startIso = addDaysIso(REFERENCE_DATE_ISO, -spanDays);

    const dateOffsets = new Set<number>();
    while (dateOffsets.size < ENTRY_COUNT) {
        dateOffsets.add(Math.floor(rng() * spanDays));
    }
    const sortedOffsets = [...dateOffsets].sort((a, b) => a - b);

    // Place semantic needle near ~11 months ago.
    const needleTargetOffset = daysBetween(startIso, SEMANTIC_NEEDLE_TARGET_ISO);
    let semanticIndex = 0;
    let bestDist = Infinity;
    for (let i = 0; i < sortedOffsets.length; i += 1) {
        const dist = Math.abs(sortedOffsets[i]! - needleTargetOffset);
        if (dist < bestDist) {
            bestDist = dist;
            semanticIndex = i;
        }
    }

    // List-only needle is the oldest entry (index 0 after sort).
    const listOnlyIndex = 0;
    // Reserve 15 distractor slots near the semantic needle in the array (not same day).
    const distractorIndices = new Set<number>();
    let d = 1;
    while (distractorIndices.size < 15 && d < ENTRY_COUNT) {
        const left = semanticIndex - d;
        const right = semanticIndex + d;
        if (left >= 0 && left !== listOnlyIndex && left !== semanticIndex) {
            distractorIndices.add(left);
        }
        if (distractorIndices.size >= 15) break;
        if (right < ENTRY_COUNT && right !== listOnlyIndex && right !== semanticIndex) {
            distractorIndices.add(right);
        }
        d += 1;
    }

    const entries: ProbeJournalEntry[] = [];
    let distractorSeq = 0;

    for (let i = 0; i < ENTRY_COUNT; i += 1) {
        const dateISO = addDaysIso(startIso, sortedOffsets[i]!);
        const id = `j-${pad2(Math.floor(i / 100))}${pad2(i % 100)}-${dateISO}`;
        const isSemanticNeedle = i === semanticIndex;
        const isListOnlyNeedle = i === listOnlyIndex;
        const isNearTopicDistractor = distractorIndices.has(i);

        let title: string;
        let body: string;
        let topic: string;

        if (isSemanticNeedle) {
            topic = 'fountain-pens';
            title = 'Cataloging the fountain pens';
            body = buildSemanticNeedleBody();
        } else if (isListOnlyNeedle) {
            topic = 'generic-start';
            title = 'Starting out';
            body = buildListOnlyNeedleBody();
        } else if (isNearTopicDistractor) {
            topic = 'writing-tools';
            title = pick(rng, [
                'Stationery thoughts',
                'Ink and paper',
                'Desk tools',
                'Handwriting mood',
                'Nib notes',
            ] as const);
            body = buildNearTopicBody(rng, distractorSeq);
            distractorSeq += 1;
        } else {
            const t = pick(rng, TOPICS);
            topic = t.id;
            title = pick(rng, t.titles);
            const seed = pick(rng, t.seeds);
            body = expandBody(rng, seed, 100, 300);
        }

        entries.push({
            id,
            dateISO,
            title,
            body,
            topic,
            wordCount: wordCount(body),
            isSemanticNeedle,
            isListOnlyNeedle,
            isNearTopicDistractor,
        });
    }

    // Newest-first index helpers
    const byDateDesc = [...entries].sort((a, b) => b.dateISO.localeCompare(a.dateISO));

    cached = {
        referenceDateISO: REFERENCE_DATE_ISO,
        entries,
        semanticNeedleId: entries[semanticIndex]!.id,
        listOnlyNeedleId: entries[listOnlyIndex]!.id,
        nearTopicDistractorIds: [...distractorIndices].map((i) => entries[i]!.id),
        oldestId: byDateDesc[byDateDesc.length - 1]!.id,
        newestId: byDateDesc[0]!.id,
    };
    return cached;
}

export function getEntryById(fixture: ProbeFixture, id: string): ProbeJournalEntry | undefined {
    return fixture.entries.find((e) => e.id === id);
}

/** Newest-first pagination. cursor is exclusive dateISO+id key or null for start. */
export function listJournals(
    fixture: ProbeFixture,
    cursor: string | null | undefined,
    limit = 10,
): { items: ProbeJournalEntry[]; nextCursor: string | null } {
    const sorted = [...fixture.entries].sort((a, b) => {
        const dc = b.dateISO.localeCompare(a.dateISO);
        if (dc !== 0) return dc;
        return b.id.localeCompare(a.id);
    });
    let start = 0;
    if (cursor) {
        const idx = sorted.findIndex((e) => `${e.dateISO}::${e.id}` === cursor);
        start = idx >= 0 ? idx + 1 : 0;
    }
    const items = sorted.slice(start, start + limit);
    const last = items[items.length - 1];
    const nextCursor = last && start + items.length < sorted.length
        ? `${last.dateISO}::${last.id}`
        : null;
    return { items, nextCursor };
}

/**
 * Simple keyword scoring for E2 tools — intentionally crude.
 * Limitation: bag-of-words only; E3 tests real embedding ranking.
 */
export function searchJournalsKeyword(
    fixture: ProbeFixture,
    query: string,
    topK = 5,
): { id: string; score: number; dateISO: string; title: string; snippet: string }[] {
    const tokens = query
        .toLowerCase()
        .split(/\s+/)
        .map((t) => t.replace(/[^a-z0-9'-]/g, ''))
        .filter((t) => t.length > 2);
    const scored = fixture.entries.map((e) => {
        const hay = `${e.title} ${e.body} ${e.topic}`.toLowerCase();
        let score = 0;
        for (const t of tokens) {
            if (hay.includes(t)) score += 1;
            // exact token bonus for distinctive needles
            if (t === SEMANTIC_NEEDLE_TOKEN.toLowerCase() && hay.includes(t)) score += 10;
        }
        return {
            id: e.id,
            score,
            dateISO: e.dateISO,
            title: e.title,
            snippet: e.body.slice(0, 220),
        };
    });
    return scored
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score || b.dateISO.localeCompare(a.dateISO))
        .slice(0, topK);
}

/** Lexical scorer mirroring localMemory tokenize+overlap style for journal rows. */
export function lexicalRankEntries(
    fixture: ProbeFixture,
    query: string,
): { id: string; score: number; rank: number }[] {
    const STOP = new Set([
        'about', 'after', 'again', 'because', 'before', 'being', 'could', 'doing',
        'feel', 'feeling', 'from', 'have', 'more', 'that', 'this', 'with', 'what',
        'when', 'where', 'which', 'while', 'would', 'your', 'their', 'them',
    ]);
    const qTokens = new Set(
        query
            .toLowerCase()
            .split(/\s+/)
            .map((t) => t.replace(/[^a-z0-9']/g, ''))
            .filter((t) => t.length > 3 && !STOP.has(t)),
    );
    const scored = fixture.entries.map((e) => {
        const text = `${e.title} ${e.body} ${e.topic}`
            .toLowerCase()
            .split(/\s+/)
            .map((t) => t.replace(/[^a-z0-9']/g, ''))
            .filter((t) => t.length > 3 && !STOP.has(t));
        const overlap = text.filter((t) => qTokens.has(t)).length;
        const score = qTokens.size === 0
            ? 0.35
            : Math.min(1, overlap / Math.max(3, qTokens.size));
        return { id: e.id, score };
    });
    scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    return scored.map((row, i) => ({ ...row, rank: i + 1 }));
}
