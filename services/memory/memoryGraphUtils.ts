import type {
    MemoryGraphAtom,
    MemoryConnection,
    MemoryLayer,
} from './memoryGraph.types';

function sharedTagsFor(atomA: MemoryGraphAtom, atomB: MemoryGraphAtom): string[] {
    const atomBTags = new Set(atomB.tags.map((tag) => tag.toLowerCase()));
    return atomA.tags.filter((tag) => atomBTags.has(tag.toLowerCase()));
}

function sameRoot(atomA: MemoryGraphAtom, atomB: MemoryGraphAtom): boolean {
    return Boolean(
        atomA.rootSourceId
        && atomB.rootSourceId
        && atomA.rootSourceId === atomB.rootSourceId
    );
}

/**
 * Edges from shared tags (≥2 tags, or 1 tag when same layer) plus
 * same-root provenance links so journal siblings stay clustered.
 */
export function computeConnections(atoms: MemoryGraphAtom[]): MemoryConnection[] {
    const connections: MemoryConnection[] = [];
    const seen = new Set<string>();

    const push = (from: string, to: string, strength: number, tags: string[]) => {
        const key = from < to ? `${from}|${to}` : `${to}|${from}`;
        if (seen.has(key)) {
            // Prefer the stronger of duplicate edges.
            const existing = connections.find(
                (edge) =>
                    (edge.from === from && edge.to === to)
                    || (edge.from === to && edge.to === from)
            );
            if (existing && strength > existing.strength) {
                existing.strength = strength;
                existing.tags = tags.length > 0 ? tags : existing.tags;
            }
            return;
        }
        seen.add(key);
        connections.push({ from, to, strength, tags });
    };

    atoms.forEach((atomA, index) => {
        atoms.slice(index + 1).forEach((atomB) => {
            if (sameRoot(atomA, atomB)) {
                push(atomA.id, atomB.id, 0.9, ['same-source']);
            }

            const tags = sharedTagsFor(atomA, atomB);
            const sameLayer = atomA.layer === atomB.layer;
            const qualifies = tags.length >= 2 || (tags.length >= 1 && sameLayer);
            if (!qualifies) return;

            push(
                atomA.id,
                atomB.id,
                Math.min(1, tags.length * 0.25 + (sameRoot(atomA, atomB) ? 0.2 : 0)),
                tags
            );
        });
    });

    return connections;
}

export function filterAtomsByTime(
    atoms: MemoryGraphAtom[],
    rangeDays: number,
    now = Date.now()
): MemoryGraphAtom[] {
    const cutoff = now - rangeDays * 24 * 60 * 60 * 1000;
    return atoms.filter((atom) => Date.parse(atom.createdAt) >= cutoff);
}

export function filterAtomsByLayer(
    atoms: MemoryGraphAtom[],
    activeLayers: Set<MemoryLayer>
): MemoryGraphAtom[] {
    return atoms.filter((atom) => activeLayers.has(atom.layer));
}

export function truncateToWordCount(text: string, maxWords: number): string {
    const trimmed = text.trim();
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) return trimmed;
    return `${words.slice(0, maxWords).join(' ')}...`;
}
