import type { LocalMemoryAtom, LocalMemoryLayer } from '@/services/memory/localMemory.types';
import { isNavigableRootKind, resolveRootSource } from '@/services/memory/memoryProvenance';
import { extractTags } from '@/services/memory/keywordRanking';
import type { NoteOrigin } from '@/services/journal/journalStorage.types';
import { getLocalDateKey } from '@/utils/date';

export type MemoryLayerFilter = LocalMemoryLayer | 'all';

export const MEMORY_LAYER_ORDER: LocalMemoryLayer[] = [
    'profile',
    'note',
    'semantic',
    'episodic',
    'procedural',
    'working',
];

export const MEMORY_LAYER_LABELS: Record<LocalMemoryLayer, string> = {
    working: 'Working',
    episodic: 'Episodes',
    semantic: 'Themes',
    procedural: 'Preferences',
    profile: 'About me',
    note: 'Notes',
};

export function formatMemoryScore(value: number): string {
    return `${Math.round(value * 100)}%`;
}

export function countLayer(
    atoms: readonly LocalMemoryAtom[],
    layer: LocalMemoryLayer
): number {
    return atoms.filter((atom) => atom.layer === layer).length;
}

export function profilePreview(atoms: readonly LocalMemoryAtom[]): string {
    const profiles = atoms
        .filter((atom) => atom.layer === 'profile')
        .sort((a, b) => b.updatedAt - a.updatedAt);
    if (profiles.length === 0) {
        return '';
    }
    // Prefer richest recent profile content for the portrait hero.
    const best = [...profiles].sort((a, b) => b.content.length - a.content.length)[0];
    return best?.content ?? '';
}

export function memoryPortraitProse(atoms: readonly LocalMemoryAtom[]): string {
    const total = atoms.length;
    const themes = topMemoryThemes(atoms, 99).length;
    const notes = countLayer(atoms, 'note');
    const parts: string[] = [];
    parts.push(`${total} ${total === 1 ? 'memory' : 'memories'}`);
    if (themes > 0) parts.push(`${themes} ${themes === 1 ? 'theme' : 'themes'}`);
    if (notes > 0) parts.push(`${notes} ${notes === 1 ? 'note' : 'notes'}`);
    return parts.join(' · ');
}

/**
 * Every theme, notes included. The previous version filtered `layer !== 'note'`
 * out because notes were a side-channel that would have polluted a ranking of
 * extracted themes. Now that a note is a first-class memory the writer chose to
 * keep, excluding them meant a user who only writes on Explore saw no themes at
 * all — the portrait would describe an empty life to the person living it.
 */
export function topMemoryThemes(atoms: readonly LocalMemoryAtom[], limit = 6): string[] {
    const counts = new Map<string, number>();
    atoms
        .flatMap((atom) => atom.tags)
        .forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));

    return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, limit)
        .map(([tag]) => tag);
}

export function filterMemoryAtoms(
    atoms: readonly LocalMemoryAtom[],
    layer: MemoryLayerFilter,
    query: string
): LocalMemoryAtom[] {
    const normalized = query.trim().toLowerCase();
    return atoms.filter((atom) => {
        const layerMatch = layer === 'all' || atom.layer === layer;
        if (!layerMatch || !normalized) return layerMatch;

        const searchable = `${atom.title} ${atom.content} ${atom.tags.join(' ')}`.toLowerCase();
        return searchable.includes(normalized);
    });
}

export function formatRelativeMemoryTime(timestamp: number, now = Date.now()): string {
    const delta = Math.max(0, now - timestamp);
    const minutes = Math.floor(delta / 60_000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 14) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export type MemoryAtomRoute =
    | { pathname: '/entry-detail'; params: { id: string } }
    | { pathname: '/checkin-detail'; params: { id: string } }
    | null;

/** Sync route from stored provenance — no I/O. */
export function memoryAtomRoute(atom: LocalMemoryAtom): MemoryAtomRoute {
    const root = resolveRootSource(atom);
    if (!root || !isNavigableRootKind(root.kind)) return null;
    if (root.kind === 'journal_entry') {
        return { pathname: '/entry-detail', params: { id: root.id } };
    }
    if (root.kind === 'intention_checkin') {
        return { pathname: '/checkin-detail', params: { id: root.id } };
    }
    return null;
}

/**
 * Live "Filed under" preview. Same matcher the write path uses, so what the
 * composer shows is what the note is actually filed under — a second
 * implementation here would let the preview promise a theme the file never got.
 */
export function themesForText(text: string): string[] {
    return extractTags(text);
}

/**
 * Same clip the write path applies before it derives themes. Re-exported from
 * the pure `keywordRanking` module (never from `exploreNote`, whose value
 * imports are the AsyncStorage write path) so the preview cannot promise a
 * theme that falls past the 600-char cut and never reaches the file.
 */
export { clipNoteText } from '@/services/memory/keywordRanking';

const LEDGER_MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Margin date column: month over day, plus the ISO key the row keys on. */
export function formatLedgerDate(timestamp: number): { month: string; day: string; iso: string } {
    const date = new Date(timestamp);
    const month = LEDGER_MONTHS[date.getMonth()] ?? '';
    return {
        month,
        day: String(date.getDate()),
        iso: getLocalDateKey(date),
    };
}

/**
 * Provenance label. `undefined` is `'chat'` — every entry saved before Explore
 * had a composer came from chat, so defaulting the other way would relabel
 * history.
 */
export function originLabel(origin: NoteOrigin | undefined): string {
    return origin === 'threads' ? 'Written on Threads' : 'Journal';
}
