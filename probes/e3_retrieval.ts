/**
 * E3 — Retrieval quality at scale (no chat model).
 * Uses REAL embed constants (EMBEDDING_MODEL / dims) + same /embeddings path.
 * Polite backoff on 429; cache vectors under .probe-cache/.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import {
    EMBEDDING_DIMENSIONS,
    EMBEDDING_MODEL,
    cosineSimilarity,
    l2Normalize,
} from '../services/memory/embeddings';
import {
    SEMANTIC_NEEDLE_TOKEN,
    buildProbeFixture,
    lexicalRankEntries,
    type ProbeFixture,
} from './shared/fixture';
import { applyProbeEnv } from './shared/loadEnv';
import { writeJsonArtifact, writeArtifact } from './shared/artifacts';

const CACHE_DIR = path.join(process.cwd(), '.probe-cache');
const BATCH_SIZE = 8;

export interface EmbedStats {
    model: string;
    dimensionsLocked: number;
    observedDim: number | null;
    requests: number;
    http429Count: number;
    otherErrors: { status: number; preview: string }[];
    wallTimeMs: number;
    cachedHits: number;
    embeddedFresh: number;
}

function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

function cacheKey(text: string): string {
    return crypto.createHash('sha256').update(`${EMBEDDING_MODEL}\n${text}`).digest('hex');
}

function readCache(key: string): number[] | null {
    const file = path.join(CACHE_DIR, `${key}.json`);
    if (!fs.existsSync(file)) return null;
    try {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as { embedding?: number[] };
        if (Array.isArray(parsed.embedding) && parsed.embedding.every((n) => typeof n === 'number')) {
            return parsed.embedding;
        }
    } catch {
        // ignore corrupt cache
    }
    return null;
}

function writeCache(key: string, embedding: number[]): void {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(
        path.join(CACHE_DIR, `${key}.json`),
        JSON.stringify({ model: EMBEDDING_MODEL, embedding }),
    );
}

/**
 * Same endpoint/model pair as services/ai/embeddingsTransport embedText,
 * with probe-only 429 backoff + cache. Not a second model path.
 */
async function embedBatchWithBackoff(
    texts: string[],
    env: { apiKey: string; apiBaseUrl: string },
    stats: EmbedStats,
): Promise<(number[] | null)[]> {
    const url = `${env.apiBaseUrl.replace(/\/+$/, '')}/embeddings`;
    const maxAttempts = 8;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        stats.requests += 1;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    Authorization: `Bearer ${env.apiKey}`,
                    'HTTP-Referer': 'https://blackrosejournal.app',
                    'X-Title': 'Blackrose Journal PROBE_LLM',
                },
                body: JSON.stringify({
                    model: EMBEDDING_MODEL,
                    input: texts.length === 1 ? texts[0] : texts,
                }),
            });
            if (response.status === 429) {
                stats.http429Count += 1;
                const backoff = Math.min(60_000, 2000 * 2 ** attempt + Math.floor(Math.random() * 500));
                // eslint-disable-next-line no-console
                console.warn(`[E3] 429 backoff ${backoff}ms (count=${stats.http429Count})`);
                await sleep(backoff);
                continue;
            }
            if (!response.ok) {
                const preview = (await response.text()).slice(0, 200);
                stats.otherErrors.push({ status: response.status, preview });
                return texts.map(() => null);
            }
            const json = (await response.json()) as {
                data?: { index?: number; embedding?: number[] }[];
            };
            const data = Array.isArray(json.data) ? [...json.data] : [];
            data.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
            return texts.map((_, i) => {
                const emb = data[i]?.embedding;
                if (!Array.isArray(emb) || emb.length === 0) return null;
                const normed = l2Normalize(emb);
                if (stats.observedDim === null) stats.observedDim = normed.length;
                return normed;
            });
        } catch (err) {
            stats.otherErrors.push({ status: 0, preview: String(err).slice(0, 200) });
            await sleep(1000 * 2 ** attempt);
        }
    }
    return texts.map(() => null);
}

async function embedAllEntries(
    fixture: ProbeFixture,
    env: { apiKey: string; apiBaseUrl: string },
): Promise<{ vectors: Map<string, number[]>; stats: EmbedStats }> {
    const stats: EmbedStats = {
        model: EMBEDDING_MODEL,
        dimensionsLocked: EMBEDDING_DIMENSIONS,
        observedDim: null,
        requests: 0,
        http429Count: 0,
        otherErrors: [],
        wallTimeMs: 0,
        cachedHits: 0,
        embeddedFresh: 0,
    };
    const t0 = Date.now();
    const vectors = new Map<string, number[]>();
    const pending: { id: string; text: string; key: string }[] = [];

    for (const e of fixture.entries) {
        const text = `${e.title}\n${e.body}`;
        const key = cacheKey(text);
        const cached = readCache(key);
        if (cached) {
            vectors.set(e.id, cached);
            stats.cachedHits += 1;
        } else {
            pending.push({ id: e.id, text, key });
        }
    }

    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
        const batch = pending.slice(i, i + BATCH_SIZE);
        // eslint-disable-next-line no-console
        console.log(`[E3] embed batch ${i / BATCH_SIZE + 1}/${Math.ceil(pending.length / BATCH_SIZE)}`);
        const embs = await embedBatchWithBackoff(batch.map((b) => b.text), env, stats);
        for (let j = 0; j < batch.length; j += 1) {
            const emb = embs[j];
            if (emb) {
                writeCache(batch[j]!.key, emb);
                vectors.set(batch[j]!.id, emb);
                stats.embeddedFresh += 1;
            }
        }
        // polite pacing between batches
        await sleep(400);
    }

    stats.wallTimeMs = Date.now() - t0;
    return { vectors, stats };
}

/** ~20 canned queries targeting semantic needle + distractors + negatives. */
export const E3_QUERIES: { id: string; query: string; expectNeedle: boolean }[] = [
    { id: 'q01', query: 'zephyr-quill-8137 fountain pen catalog code', expectNeedle: true },
    { id: 'q02', query: 'private mnemonic for rare fountain pen with zephyr-blue enamel', expectNeedle: true },
    { id: 'q03', query: 'cataloging vintage fountain pens inherited box', expectNeedle: true },
    { id: 'q04', query: 'quill-etched cap brass ink smell tactile writing', expectNeedle: true },
    { id: 'q05', query: 'distinctive flex nib dark blue dried ink', expectNeedle: true },
    { id: 'q06', query: 'fountain pen collection catalog token', expectNeedle: true },
    { id: 'q07', query: 'writing with physical pen when screens are too fast', expectNeedle: true },
    { id: 'q08', query: 'zephyr quill private code on pen', expectNeedle: true },
    { id: 'q09', query: 'antique fountain pens calligraphy', expectNeedle: true },
    { id: 'q10', query: 'where did I write about labeling pens', expectNeedle: true },
    { id: 'q11', query: 'stationery desk tools handwriting mood', expectNeedle: false },
    { id: 'q12', query: 'clogged nib mild solution rinse', expectNeedle: false },
    { id: 'q13', query: 'work deadlines and status updates', expectNeedle: false },
    { id: 'q14', query: 'sleep debt coffee foggy morning', expectNeedle: false },
    { id: 'q15', query: 'sister mom family dinner logistics', expectNeedle: false },
    { id: 'q16', query: 'budget subscriptions payday buffer', expectNeedle: false },
    { id: 'q17', query: 'morning run gym walk to think', expectNeedle: false },
    { id: 'q18', query: 'anxiety spiral chest tightness meeting', expectNeedle: false },
    { id: 'q19', query: SEMANTIC_NEEDLE_TOKEN, expectNeedle: true },
    { id: 'q20', query: 'very first journal entry starting out generic day', expectNeedle: false },
];

function rankByCosine(
    queryVec: number[],
    vectors: Map<string, number[]>,
    fixture: ProbeFixture,
): { id: string; score: number; rank: number }[] {
    const rows = fixture.entries
        .map((e) => {
            const v = vectors.get(e.id);
            const score = v ? cosineSimilarity(queryVec, v) : -1;
            return { id: e.id, score };
        })
        .sort((a, b) => b.score - a.score);
    return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

function bucket(rank: number | null): 'top-1' | 'top-5' | 'missed' | 'no-vector' {
    if (rank === null) return 'no-vector';
    if (rank === 1) return 'top-1';
    if (rank <= 5) return 'top-5';
    return 'missed';
}

export async function runE3(): Promise<{
    stats: EmbedStats;
    rankTable: unknown[];
    semanticNeedleId: string;
}> {
    const env = applyProbeEnv();
    const fixture = buildProbeFixture();
    const { vectors, stats } = await embedAllEntries(fixture, env);

    const rankTable: unknown[] = [];
    for (const q of E3_QUERIES) {
        // eslint-disable-next-line no-console
        console.log(`[E3] query ${q.id}`);
        const qEmbBatch = await embedBatchWithBackoff([q.query], env, stats);
        const qVec = qEmbBatch[0];
        let embRank: number | null = null;
        let embScore: number | null = null;
        if (qVec) {
            const ranked = rankByCosine(qVec, vectors, fixture);
            const hit = ranked.find((r) => r.id === fixture.semanticNeedleId);
            embRank = hit?.rank ?? null;
            embScore = hit?.score ?? null;
        }
        const lexical = lexicalRankEntries(fixture, q.query);
        const lexHit = lexical.find((r) => r.id === fixture.semanticNeedleId);

        rankTable.push({
            queryId: q.id,
            query: q.query,
            expectSemanticNeedle: q.expectNeedle,
            embedding: {
                needleRank: embRank,
                needleScore: embScore,
                bucket: bucket(embRank),
            },
            lexicalFallback: {
                needleRank: lexHit?.rank ?? null,
                needleScore: lexHit?.score ?? null,
                bucket: bucket(lexHit?.rank ?? null),
            },
            vectorsAvailable: vectors.size,
        });
        await sleep(300);
    }

    writeJsonArtifact('e3-retrieval.json', {
        experiment: 'E3_RETRIEVAL_QUALITY',
        embeddingModel: EMBEDDING_MODEL,
        embeddingDimensions: EMBEDDING_DIMENSIONS,
        fixtureEntries: fixture.entries.length,
        semanticNeedleId: fixture.semanticNeedleId,
        semanticNeedleDate: fixture.entries.find((e) => e.isSemanticNeedle)?.dateISO,
        embedStats: stats,
        rankTable,
    });
    writeArtifact(
        'e3-rank-table.txt',
        [
            'queryId | expectNeedle | embRank | embBucket | lexRank | lexBucket | query',
            ...rankTable.map((row) => {
                const r = row as {
                    queryId: string;
                    expectSemanticNeedle: boolean;
                    query: string;
                    embedding: { needleRank: number | null; bucket: string };
                    lexicalFallback: { needleRank: number | null; bucket: string };
                };
                return [
                    r.queryId,
                    r.expectSemanticNeedle,
                    r.embedding.needleRank ?? 'null',
                    r.embedding.bucket,
                    r.lexicalFallback.needleRank ?? 'null',
                    r.lexicalFallback.bucket,
                    r.query.slice(0, 60),
                ].join(' | ');
            }),
        ].join('\n'),
    );

    return { stats, rankTable, semanticNeedleId: fixture.semanticNeedleId };
}
