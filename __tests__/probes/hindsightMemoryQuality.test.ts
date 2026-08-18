/**
 * E6 — Memory quality at four horizons (1mo / 3mo / 6mo / 1yr).
 * Requires a populated bank (run scripts/hindsight/populate-memory.mjs first)
 * and PROBE_LLM=1. Writes probes/artifacts/hindsight-memory-quality.json
 * with per-needle hits + latencies and reflect results.
 *
 *   PROBE_LLM=1 npx jest --runInBand __tests__/probes/hindsightMemoryQuality.test.ts --forceExit
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
    hindsightRecall,
    hindsightReflect,
    type HindsightRecallHit,
} from '../../services/memory/hindsight/hindsightClient';

const PROBE = process.env.PROBE_LLM === '1';
const ARTIFACTS = join(process.cwd(), 'probes', 'artifacts');
const NEEDLES_PATH = join(ARTIFACTS, 'hindsight-needles.json');
const OUTPUT_PATH = join(ARTIFACTS, 'hindsight-memory-quality.json');

const FLOORS: Record<string, number> = { '1mo': 0.8, '3mo': 0.8, '6mo': 0.7, '1yr': 0.6 };

interface Needle {
    needleId: string;
    bucket: string;
    query: string;
    documentId: string;
}

function loadNeedles(): Needle[] {
    const parsed = JSON.parse(readFileSync(NEEDLES_PATH, 'utf8')) as { needles: Needle[] };
    return parsed.needles;
}

// Container quirk (verified): /recall ignores the `limit` param and returns a
// fixed-ranked set. Rank defensively by similarity and evaluate only the top 6.
function topSix(hits: HindsightRecallHit[] | null): HindsightRecallHit[] {
    return (hits ?? []).slice().sort((a, b) => b.similarity - a.similarity).slice(0, 6);
}

describe('hindsight memory quality (E6)', () => {
    if (!PROBE) {
        it('skipped without PROBE_LLM=1', () => expect(true).toBe(true));
        return;
    }

    const OLD_BASE_URL = process.env.EXPO_PUBLIC_HINDSIGHT_BASE_URL;
    const results: Record<string, unknown> = { buckets: {}, needles: [], reflect: [] };

    beforeAll(() => {
        // The client reads this at call time; pin the local container so the
        // battery never depends on a shell/.env value (restored in afterAll).
        process.env.EXPO_PUBLIC_HINDSIGHT_BASE_URL = 'http://localhost:8888';
    });

    afterAll(() => {
        if (OLD_BASE_URL === undefined) {
            delete process.env.EXPO_PUBLIC_HINDSIGHT_BASE_URL;
        } else {
            process.env.EXPO_PUBLIC_HINDSIGHT_BASE_URL = OLD_BASE_URL;
        }
        mkdirSync(ARTIFACTS, { recursive: true });
        writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));
    });

    it('recall retrieves planted needles within horizon floors', async () => {
        const needles = loadNeedles();
        const buckets: Record<string, { hit: number; total: number }> = {};
        for (const needle of needles) {
            const started = Date.now();
            const hits = await hindsightRecall(needle.query, { limit: 6 });
            const latencyMs = Date.now() - started;
            // Container also emits auto-extracted world/observation units — the
            // same documentId can appear on several hits, so .some() is right.
            const found = topSix(hits).some((h) => h.documentId === needle.documentId);
            buckets[needle.bucket] ??= { hit: 0, total: 0 };
            buckets[needle.bucket].total += 1;
            if (found) buckets[needle.bucket].hit += 1;
            results.needles.push({ ...needle, found, latencyMs });
        }
        results.buckets = buckets;

        const failures: string[] = [];
        for (const [bucket, floor] of Object.entries(FLOORS)) {
            const stats = buckets[bucket] ?? { hit: 0, total: 0 };
            const rate = stats.total === 0 ? 0 : stats.hit / stats.total;
            if (rate < floor) failures.push(`${bucket}: ${stats.hit}/${stats.total} (floor ${floor})`);
        }
        expect(failures).toEqual([]);
    }, 120_000);

    it('reflect is grounded in planted entities', async () => {
        const probes = [
            { q: 'What happened at Maya\u2019s wedding?', entity: 'garden' },
            { q: 'What job did I accept and where?', entity: 'Brightline' },
            { q: 'Where did Priya move?', entity: 'Vancouver' },
        ];
        for (const probe of probes) {
            const started = Date.now();
            const reflection = await hindsightReflect(probe.q);
            const latencyMs = Date.now() - started;
            const grounded = Boolean(
                reflection && reflection.toLowerCase().includes(probe.entity.toLowerCase()),
            );
            results.reflect.push({ ...probe, grounded, latencyMs, excerpt: (reflection ?? '').slice(0, 300) });
            expect(grounded).toBe(true);
        }
    }, 120_000);
});
