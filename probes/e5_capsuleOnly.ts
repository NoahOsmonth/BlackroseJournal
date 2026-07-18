/**
 * E5 — What-if: capsule-only future (no tools).
 * Using E3 rankings, simulate hard-capped ~1.5k-token always-injected capsule.
 */

import fs from 'fs';
import path from 'path';

import {
    EMBEDDING_MODEL,
    cosineSimilarity,
    l2Normalize,
} from '../services/memory/embeddings';
import {
    buildProbeFixture,
    type ProbeFixture,
} from './shared/fixture';
import { applyProbeEnv } from './shared/loadEnv';
import { writeJsonArtifact, writeArtifact } from './shared/artifacts';
import { E3_QUERIES } from './e3_retrieval';
import crypto from 'crypto';

const CAPSULE_TOKEN_BUDGET = 1500;
/** Rough chars-per-token for English journal text. */
const CHARS_PER_TOKEN = 4;
const CACHE_DIR = path.join(process.cwd(), '.probe-cache');

function estimateTokens(text: string): number {
    return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function cacheKey(text: string): string {
    return crypto.createHash('sha256').update(`${EMBEDDING_MODEL}\n${text}`).digest('hex');
}

function readCache(key: string): number[] | null {
    const file = path.join(CACHE_DIR, `${key}.json`);
    if (!fs.existsSync(file)) return null;
    try {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as { embedding?: number[] };
        if (Array.isArray(parsed.embedding)) return parsed.embedding;
    } catch {
        // ignore
    }
    return null;
}

function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

async function embedOne(
    text: string,
    env: { apiKey: string; apiBaseUrl: string },
): Promise<number[] | null> {
    const key = cacheKey(text);
    const cached = readCache(key);
    if (cached) return cached;

    const url = `${env.apiBaseUrl.replace(/\/+$/, '')}/embeddings`;
    for (let attempt = 0; attempt < 6; attempt += 1) {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Authorization: `Bearer ${env.apiKey}`,
                'HTTP-Referer': 'https://blackrosejournal.app',
                'X-Title': 'Blackrose Journal PROBE_LLM',
            },
            body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
        });
        if (response.status === 429) {
            await sleep(2000 * 2 ** attempt);
            continue;
        }
        if (!response.ok) return null;
        const json = (await response.json()) as { data?: { embedding?: number[] }[] };
        const emb = json.data?.[0]?.embedding;
        if (!Array.isArray(emb)) return null;
        const normed = l2Normalize(emb);
        fs.mkdirSync(CACHE_DIR, { recursive: true });
        fs.writeFileSync(
            path.join(CACHE_DIR, `${key}.json`),
            JSON.stringify({ model: EMBEDDING_MODEL, embedding: normed }),
        );
        return normed;
    }
    return null;
}

function loadEntryVectors(fixture: ProbeFixture): Map<string, number[]> {
    const map = new Map<string, number[]>();
    for (const e of fixture.entries) {
        const text = `${e.title}\n${e.body}`;
        const v = readCache(cacheKey(text));
        if (v) map.set(e.id, v);
    }
    return map;
}

function formatCapsuleLine(e: { dateISO: string; title: string; body: string }): string {
    const snippet = e.body.slice(0, 280).replace(/\s+/g, ' ');
    return `- Written ${e.dateISO}: ${e.title} — ${snippet}`;
}

/**
 * Greedy top-k by cosine until token budget exhausted.
 */
function buildCapsule(
    rankedIds: string[],
    fixture: ProbeFixture,
    budgetTokens: number,
): { ids: string[]; tokens: number; text: string } {
    const byId = new Map(fixture.entries.map((e) => [e.id, e]));
    const lines: string[] = ['## Memory capsule (probe simulation, no tools)'];
    const ids: string[] = [];
    let tokens = estimateTokens(lines[0]!);
    for (const id of rankedIds) {
        const e = byId.get(id);
        if (!e) continue;
        const line = formatCapsuleLine(e);
        const t = estimateTokens(line);
        if (tokens + t > budgetTokens) break;
        lines.push(line);
        ids.push(id);
        tokens += t;
    }
    return { ids, tokens, text: lines.join('\n') };
}

export async function runE5(options?: {
    /** Optional precomputed rank table from E3; if missing, re-rank from cache. */
    reuseE3?: boolean;
}): Promise<{ table: unknown[]; vectorsLoaded: number }> {
    const env = applyProbeEnv();
    const fixture = buildProbeFixture();
    const vectors = loadEntryVectors(fixture);

    // If E3 already wrote ranks, prefer re-simulating capsule from fresh rank order.
    const table: unknown[] = [];

    for (const q of E3_QUERIES) {
        const qVec = await embedOne(q.query, env);
        let rankedIds: string[] = [];
        if (qVec && vectors.size > 0) {
            rankedIds = fixture.entries
                .map((e) => {
                    const v = vectors.get(e.id);
                    return { id: e.id, score: v ? cosineSimilarity(qVec, v) : -1 };
                })
                .sort((a, b) => b.score - a.score)
                .map((r) => r.id);
        } else {
            // offline fallback: lexical order only
            rankedIds = fixture.entries
                .map((e) => e.id);
        }

        const capsule = buildCapsule(rankedIds, fixture, CAPSULE_TOKEN_BUDGET);
        const needleInCapsule = capsule.ids.includes(fixture.semanticNeedleId);
        const needleRank = rankedIds.indexOf(fixture.semanticNeedleId);
        table.push({
            queryId: q.id,
            query: q.query,
            expectNeedle: q.expectNeedle,
            needleGlobalRank: needleRank >= 0 ? needleRank + 1 : null,
            capsuleEntryCount: capsule.ids.length,
            capsuleTokensEst: capsule.tokens,
            needleMakesCut: needleInCapsule,
            note: needleInCapsule
                ? 'needle in always-injected capsule without tools'
                : 'needle EXCLUDED — tools would be required to surface it',
        });
        await sleep(200);
    }

    writeJsonArtifact('e5-capsule-only.json', {
        experiment: 'E5_CAPSULE_ONLY_WHATIF',
        budgetTokens: CAPSULE_TOKEN_BUDGET,
        charsPerToken: CHARS_PER_TOKEN,
        semanticNeedleId: fixture.semanticNeedleId,
        vectorsLoaded: vectors.size,
        table,
        options,
    });
    writeArtifact(
        'e5-simulation-table.txt',
        [
            'queryId | expect | globalRank | capsuleN | tokens | makesCut | query',
            ...table.map((row) => {
                const r = row as {
                    queryId: string;
                    expectNeedle: boolean;
                    needleGlobalRank: number | null;
                    capsuleEntryCount: number;
                    capsuleTokensEst: number;
                    needleMakesCut: boolean;
                    query: string;
                };
                return [
                    r.queryId,
                    r.expectNeedle,
                    r.needleGlobalRank ?? 'null',
                    r.capsuleEntryCount,
                    r.capsuleTokensEst,
                    r.needleMakesCut ? 'YES' : 'no',
                    r.query.slice(0, 50),
                ].join(' | ');
            }),
        ].join('\n'),
    );

    return { table, vectorsLoaded: vectors.size };
}
