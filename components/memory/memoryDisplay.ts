import type { LocalMemoryAtom, LocalMemoryLayer } from '@/services/memory/localMemory.types';

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
    const profile = atoms.find((atom) => atom.layer === 'profile');
    return profile?.content ?? 'Rosebud has not saved about-me memory yet.';
}

export function topMemoryThemes(atoms: readonly LocalMemoryAtom[], limit = 6): string[] {
    const counts = new Map<string, number>();
    atoms
        .filter((atom) => atom.layer !== 'note')
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
