import * as fs from 'fs';
import * as path from 'path';

/**
 * The composer's preview must clip and match themes exactly as the write path
 * does — which is why it needs the pure `keywordRanking` helpers — but it must
 * NOT reach the write path itself. `exploreNote.ts` value-imports `localMemory`,
 * `memoryFiles`, `dayDigestStorage` and `journalStorage`, and `localMemory`
 * transitively reaches `memoryAtomExtraction` → the JSON completion transport.
 *
 * This failure mode has now appeared twice: Task 7 fixed it for `extractTags`
 * (moved out of `localMemory.ts` into the import-free `keywordRanking.ts`), and
 * the round-2 correction fixed it for `clipNoteText`. A pure string helper in a
 * component's graph drags the whole AsyncStorage write path and a provider
 * transport into that component's bundle. Asserted on the module graph rather
 * than on a mock: a mock proves the module was not reached on the path the test
 * took, not that it cannot be reached at all.
 */

const ROOT = process.cwd();

/**
 * Modules a pure display component must never load, directly or transitively.
 *
 * The provider half of this list mirrors `LLM_MODULES` in
 * `__tests__/services/exploreNoteImports.test.ts`. Naming only the two providers
 * the write path happens to touch today left a direct
 * `import { fetchDirectChatCompletion } from '@/services/ai/directTransport'` in
 * the composer passing green — the guard would have caught the regression it was
 * written for but not the class of regression it describes.
 */
const FORBIDDEN_MODULES = [
    'services/memory/exploreNote',
    'services/memory/localMemory',
    'services/memory/memoryFiles',
    'services/memory/dayDigestStorage',
    'services/memory/memoryAtomExtraction',
    'services/memory/identityExtraction',
    'services/memory/sessionDigestBuild',
    'services/memory/memoryRollupBuild',
    'services/memory/memoryDream',
    'services/journal/journalStorage',
    'services/ai/directTransport',
    'services/ai/streamingTransports',
    'services/ai/modelContext',
    'services/ai/customModels',
    'services/ai/jsonCompletion',
    'services/ai/agentLoop',
    'services/ai/ai',
];

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
 * Every module specifier that is a runtime dependency: static `import … from`,
 * `export … from` (a re-export is a real runtime edge), dynamic `import('…')`,
 * and bare `import '…'` side-effect imports. Multi-line aware, both quote
 * styles.
 *
 * Skips `import type … from` and `export type … from` statements and any
 * `*.types.ts` target — those edges are erased at compile time and are not
 * runtime dependencies. An inline `{ type X }` specifier in a value import keeps
 * the edge: erring toward reporting a dependency is safe, erring toward hiding
 * one is exactly the bug this guard exists to catch.
 */
function importedModules(file: string): string[] {
    const source = fs.readFileSync(file, 'utf8');
    const targets: string[] = [];
    const add = (spec: string | undefined): void => {
        if (!spec) return;
        const target = resolveSpec(file, spec);
        if (!target || /\.types\.ts$/.test(target)) return;
        targets.push(target);
    };

    // `import … from 'x'` / `export … from 'x'`, including multi-line braces.
    for (const match of source.matchAll(/^[ \t]*(import|export)\b(?![ \t]*\()([^;]*?)\bfrom\s+(['"])([^'"]+)\3/gm)) {
        if (/^[ \t]*(?:import|export)\s+type\b/.test(match[0])) continue;
        add(match[4]);
    }
    // Dynamic `import('x')` — a lazy provider load is still a provider load.
    for (const match of source.matchAll(/\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g)) {
        add(match[2]);
    }
    // Bare `import 'x'` side-effect import.
    for (const match of source.matchAll(/^[ \t]*import\s+(['"])([^'"]+)\1/gm)) {
        add(match[2]);
    }
    return targets;
}

function relativeModule(file: string): string {
    return path.relative(ROOT, file).replace(/\\/g, '/').replace(/\.tsx?$/, '');
}

/**
 * The pure display set in `components/memory/`. Task 14 added the ledger row,
 * the empty state and the skeleton next to the composer, so rooting the walk at
 * the composer alone guarded the smallest part of the surface this file
 * describes: a provider or write-path import dragged into any of the others
 * would have gone unseen. `MemoryHubScreen.tsx` is deliberately **not** here —
 * it is the screen, it legitimately owns the hook and the write path.
 */
const DISPLAY_ENTRIES = [
    'components/memory/ExploreComposer.tsx',
    'components/memory/MemoryLedgerRow.tsx',
    'components/memory/MemoryEmpty.tsx',
    'components/memory/MemoryHubSkeleton.tsx',
].map((relative) => path.join(ROOT, relative));

describe('ExploreComposer import graph', () => {
    it('does not reach the note write path, the atom store, or a provider', () => {
        const seen = new Set<string>();
        const queue = [...DISPLAY_ENTRIES];
        const offenders: string[] = [];

        while (queue.length > 0) {
            const file = queue.pop()!;
            if (seen.has(file)) continue;
            seen.add(file);
            const relative = relativeModule(file);
            if (FORBIDDEN_MODULES.includes(relative)) {
                offenders.push(relative);
                continue;
            }
            queue.push(...importedModules(file));
        }

        // A walk that visited nothing would pass vacuously.
        expect(seen.size).toBeGreaterThan(1);
        // ...and so would a walk that never left the first entry, so pin that
        // every root was actually visited.
        for (const entry of DISPLAY_ENTRIES) {
            expect(seen.has(entry)).toBe(true);
        }
        expect(offenders).toEqual([]);
    });

    it('clips through the pure keyword module, not the write path', () => {
        // Closes the hole a walk-only assertion would leave: this names the
        // helper's real source, so moving it back behind the write path fails
        // here even if the transitive walk were somehow pruned.
        const entry = path.join(ROOT, 'components/memory/ExploreComposer.tsx');
        const direct = importedModules(entry).map(relativeModule);

        expect(direct).not.toContain('services/memory/exploreNote');
        expect(direct).toContain('components/memory/memoryDisplay');
    });
});
