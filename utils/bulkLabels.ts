/**
 * Which labels every one of these entries carries. The pick bar only offers a
 * removal for labels the whole selection shares: offering a label that just some
 * of them have would quietly do less than the sentence promises.
 */
export function sharedLabels(
    entryIds: readonly string[],
    tagsByEntry: Readonly<Record<string, readonly string[]>>,
): readonly string[] {
    if (entryIds.length === 0) return [];
    const counts = new Map<string, number>();
    for (const id of entryIds) {
        const seen = new Set<string>();
        for (const tag of tagsByEntry[id] ?? []) {
            if (tag.length === 0 || seen.has(tag)) continue;
            seen.add(tag);
            counts.set(tag, (counts.get(tag) ?? 0) + 1);
        }
    }
    return Array.from(counts.entries())
        .filter(([, count]) => count === entryIds.length)
        .map(([label]) => label)
        .sort((a, b) => a.localeCompare(b));
}
