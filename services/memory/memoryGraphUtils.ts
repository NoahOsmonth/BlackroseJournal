import type {
    MemoryGraphAtom,
    MemoryConnection,
    MemoryLayer,
} from './memoryGraph.types';

function sharedTagsFor(atomA: MemoryGraphAtom, atomB: MemoryGraphAtom): string[] {
    const atomBTags = new Set(atomB.tags.map((tag) => tag.toLowerCase()));
    return atomA.tags.filter((tag) => atomBTags.has(tag.toLowerCase()));
}

export function computeConnections(atoms: MemoryGraphAtom[]): MemoryConnection[] {
    const connections: MemoryConnection[] = [];

    atoms.forEach((atomA, index) => {
        atoms.slice(index + 1).forEach((atomB) => {
            const tags = sharedTagsFor(atomA, atomB);
            if (tags.length === 0) return;

            connections.push({
                from: atomA.id,
                to: atomB.id,
                strength: Math.min(1, tags.length * 0.25),
                tags,
            });
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
