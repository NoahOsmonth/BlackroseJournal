import type { MemoryConnection, MemoryGraphAtom } from './memoryGraph.types';

/**
 * Related-node lookup for the memory sheet.
 * (At-a-glance copy is AI-generated in memoryInsightService — not templated here.)
 */
export function relatedGraphAtoms(
    atom: MemoryGraphAtom,
    allAtoms: readonly MemoryGraphAtom[],
    connections: readonly MemoryConnection[],
    limit = 3
): MemoryGraphAtom[] {
    const neighborIds = new Set<string>();
    connections.forEach((edge) => {
        if (edge.from === atom.id) neighborIds.add(edge.to);
        if (edge.to === atom.id) neighborIds.add(edge.from);
    });

    const byId = new Map(allAtoms.map((item) => [item.id, item]));
    const fromEdges = [...neighborIds]
        .map((id) => byId.get(id))
        .filter((item): item is MemoryGraphAtom => Boolean(item));

    const sameRoot = atom.rootSourceId
        ? allAtoms.filter(
            (other) => other.id !== atom.id && other.rootSourceId === atom.rootSourceId
        )
        : [];

    const seen = new Set<string>();
    const ordered: MemoryGraphAtom[] = [];
    for (const candidate of [...sameRoot, ...fromEdges]) {
        if (seen.has(candidate.id) || candidate.id === atom.id) continue;
        seen.add(candidate.id);
        ordered.push(candidate);
        if (ordered.length >= limit) break;
    }
    return ordered;
}
