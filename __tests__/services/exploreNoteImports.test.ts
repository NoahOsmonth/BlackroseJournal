import * as fs from 'fs';
import * as path from 'path';

/**
 * Success criterion 3 of the spec: no model call fires at write time.
 *
 * Asserted on the module graph rather than on a mock, because a mock proves the
 * call did not happen on the path the test took — not that the module cannot
 * reach a provider at all.
 *
 * Scope note: a provider-free graph is NOT achievable for this write path.
 * `saveExploreNote` must call `upsertMemoryAtom`, which lives in `localMemory.ts`,
 * which value-imports `memoryAtomExtraction.ts`, which value-imports the JSON
 * completion transport. That edge is pre-existing and outside this plan. So the
 * guard is scoped to what is true and to the risk that matters: the write path
 * reaches no provider EXCEPT through that one named boundary, and `exploreNote.ts`
 * itself never imports a provider or the boundary directly.
 */

const ROOT = process.cwd();

/** Modules that reach a provider, directly or through a wrapper. */
const LLM_MODULES = [
    'services/ai/directTransport',
    'services/ai/chat',
    'services/ai/jsonCompletion',
    'services/ai/agentLoop',
    'services/ai/ai',
    'services/memory/identityExtraction',
    'services/memory/sessionDigestBuild',
    'services/memory/memoryRollupBuild',
    'services/memory/memoryDream',
];

/**
 * The one pre-existing edge the write path cannot avoid, pruned with a reason.
 * `localMemory.ts` owns `upsertMemoryAtom` (which this path must call) and that
 * module value-imports the deterministic extractors, which reach the transport.
 * Pruning is safe ONLY because the direct-import assertion below separately
 * forbids `exploreNote.ts` from importing this module itself.
 */
const BOUNDARY_MODULES = ['services/memory/memoryAtomExtraction'];

function resolveSpec(fromFile: string, spec: string): string | null {
    const base = spec.startsWith('@/')
        ? path.join(ROOT, spec.slice(2))
        : spec.startsWith('.')
            ? path.resolve(path.dirname(fromFile), spec)
            : null;
    if (!base) return null;
    for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
        if (fs.existsSync(candidate)) return candidate;
    }
    return null;
}

/**
 * Value imports only. Multi-line aware, and it skips `import type` statements
 * and `*.types.ts` declaration modules — those edges are erased at compile time
 * and are not runtime dependencies of the write path.
 */
function importedModules(file: string): string[] {
    const source = fs.readFileSync(file, 'utf8');
    const targets: string[] = [];
    for (const match of source.matchAll(/^[ \t]*import\s+(type\s+)?([\s\S]*?)\bfrom\s+'([^']+)'/gm)) {
        if (match[1]) continue;
        const target = resolveSpec(file, match[3]!);
        if (!target || /\.types\.ts$/.test(target)) continue;
        targets.push(target);
    }
    return targets;
}

function relativeModule(file: string): string {
    return path.relative(ROOT, file).replace(/\\/g, '/').replace(/\.tsx?$/, '');
}

describe('Explore write path cannot reach a model', () => {
    it('has no provider module in its import graph outside the named boundary', () => {
        const entry = path.join(ROOT, 'services/memory/exploreNote.ts');
        const seen = new Set<string>();
        const queue = [entry];
        const offenders: string[] = [];

        while (queue.length > 0) {
            const file = queue.pop()!;
            if (seen.has(file)) continue;
            seen.add(file);
            const relative = relativeModule(file);
            if (LLM_MODULES.includes(relative)) {
                offenders.push(relative);
                continue;
            }
            if (BOUNDARY_MODULES.includes(relative)) continue;
            queue.push(...importedModules(file));
        }

        // A walk that visited nothing would pass vacuously.
        expect(seen.size).toBeGreaterThan(1);
        expect(offenders).toEqual([]);
    });

    it('does not import a provider or the extraction boundary directly', () => {
        // Closes the hole the boundary prune would otherwise open: without this,
        // adding `import { extractJournalMemoryAtoms } from './memoryAtomExtraction'`
        // to exploreNote.ts would keep the graph assertion above green while
        // putting a model call back on the write path.
        const entry = path.join(ROOT, 'services/memory/exploreNote.ts');
        const direct = importedModules(entry).map(relativeModule);
        const forbidden = [...LLM_MODULES, ...BOUNDARY_MODULES];

        expect(direct.filter((module) => forbidden.includes(module))).toEqual([]);
    });
});
