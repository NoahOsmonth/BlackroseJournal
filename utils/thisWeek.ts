/**
 * "What kept coming back" — the quiet themes of the last seven days.
 *
 * Kaneo #10. The writer should not have to re-read a week of entries to notice
 * that sleep came up five times. This module is the counting half: it takes
 * finished entries and returns the few words that recurred across more than one
 * day, in plain language, with nothing scored, judged or ranked by "importance".
 *
 * Pure on purpose — no storage, no AI, no clock of its own.
 */

export interface ThemeEntry {
    /** Local date key (YYYY-MM-DD) the entry belongs to. */
    readonly dateKey: string;
    /** The writer's own words, already joined. */
    readonly text: string;
}

export interface WeeklyTheme {
    /** Display form, e.g. "sleep". */
    readonly label: string;
    /** How many different days mentioned it. */
    readonly days: number;
    /** How many times it appeared in total. */
    readonly mentions: number;
}

export interface WeekLedger {
    /** Days in the window that have at least one finished entry. */
    readonly daysWritten: number;
    readonly totalDays: number;
    readonly themes: WeeklyTheme[];
}

/** Words that carry no theme. Kept deliberately short: this is a journal, not search. */
const STOP_WORDS = new Set([
    'about', 'after', 'again', 'against', 'almost', 'also', 'always', 'another', 'around',
    'because', 'been', 'before', 'being', 'better', 'both', 'came', 'could', 'did', 'does',
    'doing', 'down', 'during', 'each', 'even', 'every', 'feel', 'felt', 'from', 'going', 'good',
    'gonna', 'gotta', 'have', 'having', 'here', 'into', 'just', 'keep', 'kind', 'know', 'last',
    'like', 'little', 'lot', 'made', 'make', 'many', 'maybe', 'more', 'most', 'much', 'myself',
    'need', 'never', 'next', 'nice', 'only', 'other', 'over', 'really', 'right', 'said', 'same',
    'some', 'something', 'still', 'such', 'sure', 'than', 'that', 'their', 'them', 'then',
    'there', 'these', 'they', 'thing', 'things', 'think', 'this', 'those', 'though', 'through',
    'time', 'today', 'took', 'under', 'very', 'want', 'well', 'were', 'what', 'when', 'where',
    'which', 'while', 'will', 'with', 'would', 'your', 'yourself',
]);

/**
 * Word forms that mean the same theme for a journal. Deliberately tiny: only
 * forms a writer actually alternates between in casual writing.
 */
const WORD_ALIASES: Record<string, string> = {
    slept: 'sleep',
    sleeping: 'sleep',
    stressed: 'stress',
    stressing: 'stress',
    worried: 'worry',
    worrying: 'worry',
    anxious: 'anxiety',
};

const MIN_WORD_LENGTH = 4;
const MIN_DAYS = 2;
const MIN_MENTIONS = 2;
const MAX_THEMES = 5;

/** Lowercase, strip anything that is not a letter or apostrophe. */
function normalizeWord(raw: string): string {
    return raw.toLowerCase().replace(/[^a-z']/g, '').replace(/^'+|'+$/g, '');
}

/** Crude plural folding so "walks" and "walk" count as one theme. */
function foldWord(word: string): string {
    if (word.length > 4 && word.endsWith('ies')) return word.slice(0, -3) + 'y';
    // Only drop "es" when it is a real plural ending (wishes → wish), never a
    // verb that merely ends in "s" (was, makes, means stay intact).
    if (word.length > 4 && /(sh|ch|x|ss)es$/.test(word)) return word.slice(0, -2);
    if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
    return word;
}

function isThemeWord(word: string): boolean {
    if (word.length < MIN_WORD_LENGTH) return false;
    if (STOP_WORDS.has(word)) return false;
    return /[a-z]/.test(word);
}

/**
 * The quiet themes of a week. A word must appear on **two different days** — one
 * entry repeating a word is not "kept coming back", it is one long thought.
 */
export function collectWeeklyThemes(entries: readonly ThemeEntry[], totalDays = 7): WeekLedger {
    const daysWithText = new Set(entries.map((entry) => entry.dateKey));

    const daysPerWord = new Map<string, Set<string>>();
    const mentionsPerWord = new Map<string, number>();

    for (const entry of entries) {
        const words = entry.text.split(/\s+/).map(normalizeWord).filter(isThemeWord);
        for (const word of words) {
            const label = WORD_ALIASES[word] ?? foldWord(word);
            if (!isThemeWord(label)) continue;
            const days = daysPerWord.get(label) ?? new Set<string>();
            days.add(entry.dateKey);
            daysPerWord.set(label, days);
            mentionsPerWord.set(label, (mentionsPerWord.get(label) ?? 0) + 1);
        }
    }

    const themes: WeeklyTheme[] = [];
    for (const [label, days] of daysPerWord) {
        const mentions = mentionsPerWord.get(label) ?? 0;
        if (days.size < MIN_DAYS || mentions < MIN_MENTIONS) continue;
        themes.push({ label, days: days.size, mentions });
    }

    // Steadiest first, then alphabetical so the order never wobbles between two
    // identical weeks.
    themes.sort((a, b) => b.days - a.days || b.mentions - a.mentions || a.label.localeCompare(b.label));

    return {
        daysWritten: daysWithText.size,
        totalDays,
        themes: themes.slice(0, MAX_THEMES),
    };
}

/**
 * Which day keys fall inside the CALENDAR week (Sunday to Saturday)
 * containing `todayKey`.
 *
 * This used to be a rolling seven days ending today, which is a different
 * set of days from the one Insights calls "this week" (run 28 fixed the same
 * mistake in the mood strip): on Sunday 8 Nov a rolling window covers 2-8 Nov
 * while the weekly letter, the writing stats and the unlock threshold all use
 * 8-14 Nov. Two screens calling different seven-day spans "this week" is the
 * bug; anchor on the week start so the whole app agrees.
 */
export function weekWindowKeys(todayKey: string, totalDays = 7): string[] {
    const [year, month, day] = todayKey.split('-').map(Number);
    if (!year || !month || !day) return [];
    // Walk back to the Sunday of the week containing todayKey, then forward.
    // Date.UTC keeps this arithmetic free of local-DST hour shifts.
    const anchor = new Date(Date.UTC(year, month - 1, day));
    anchor.setUTCDate(anchor.getUTCDate() - anchor.getUTCDay());
    const keys: string[] = [];
    for (let offset = 0; offset < totalDays; offset += 1) {
        const d = new Date(anchor.getTime() + offset * 86400000);
        keys.push(d.toISOString().slice(0, 10));
    }
    return keys;
}
