/**
 * THROWAWAY — Memory v3 embedding model validation.
 * Not a permanent test. Delete after model is locked.
 *
 * Usage (from repo root, with .env present):
 *   node scripts/validate-embeddings-throwaway.mjs
 *   node scripts/validate-embeddings-throwaway.mjs nvidia
 *   node scripts/validate-embeddings-throwaway.mjs perplexity
 *   node scripts/validate-embeddings-throwaway.mjs both
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env');
  const text = readFileSync(envPath, 'utf8');
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"'))
      || (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const env = loadEnv();
const API_KEY = env.EXPO_PUBLIC_NANO_GPT_API_KEY;
const BASE = (env.EXPO_PUBLIC_NANO_GPT_API_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');

if (!API_KEY || API_KEY.includes('YOUR_')) {
  console.error('Missing EXPO_PUBLIC_NANO_GPT_API_KEY in .env');
  process.exit(1);
}

const MODELS = {
  nvidia: 'nvidia/llama-nemotron-embed-vl-1b-v2:free',
  perplexity: 'perplexity/pplx-embed-v1-0.6b',
};

/** 3 similar pairs + 3 dissimilar pairs (journal-like phrasing). */
const PAIRS = [
  {
    kind: 'similar',
    id: 'S1-work-stress',
    a: "Work has been crushing me — deadlines keep piling up and I can't sleep.",
    b: "I'm overwhelmed by office pressure; every project feels urgent and I'm exhausted.",
  },
  {
    kind: 'similar',
    id: 'S2-family',
    a: 'Talked with my sister about mom’s health; it left me feeling heavy and worried.',
    b: 'Family conversation about our mother’s condition made me anxious all evening.',
  },
  {
    kind: 'similar',
    id: 'S3-exercise',
    a: 'Went for a long run this morning and felt clearer afterward.',
    b: 'Morning jog helped me reset my head; the movement was good for my mood.',
  },
  {
    kind: 'dissimilar',
    id: 'D1-work-vs-recipe',
    a: "Work has been crushing me — deadlines keep piling up and I can't sleep.",
    b: 'Tonight I made a simple tomato pasta with garlic and basil.',
  },
  {
    kind: 'dissimilar',
    id: 'D2-family-vs-weather',
    a: 'Talked with my sister about mom’s health; it left me feeling heavy and worried.',
    b: 'It rained all afternoon so I stayed inside and watched a comedy.',
  },
  {
    kind: 'dissimilar',
    id: 'D3-exercise-vs-finance',
    a: 'Went for a long run this morning and felt clearer afterward.',
    b: 'I need to review my budget and cut subscription costs this month.',
  },
];

function l2Norm(v) {
  let s = 0;
  for (let i = 0; i < v.length; i += 1) s += v[i] * v[i];
  return Math.sqrt(s);
}

function cosineSimilarity(a, b) {
  if (!a?.length || a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a?.length} vs ${b?.length}`);
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (denom === 0) return 0;
  return dot / denom;
}

function describeVector(v) {
  const sample = v.slice(0, 8).map((x) => Number(x));
  const norms = l2Norm(v);
  const min = Math.min(...v);
  const max = Math.max(...v);
  const absMax = Math.max(...v.map((x) => Math.abs(x)));
  const looksIntish = v.every((x) => Number.isFinite(x) && Math.abs(x - Math.round(x)) < 1e-6);
  const integerRange = looksIntish && absMax <= 128;
  return {
    dim: v.length,
    l2: norms,
    min,
    max,
    sample,
    looksIntish,
    integerRange,
    likelyUnitNormalized: Math.abs(norms - 1) < 0.02,
  };
}

async function embedBatch(model, texts, encodingFormat) {
  const body = {
    model,
    input: texts,
  };
  if (encodingFormat) body.encoding_format = encodingFormat;

  const res = await fetch(`${BASE}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'HTTP-Referer': 'https://blackrosejournal.local',
      'X-Title': 'BlackroseJournal-embedding-validation',
    },
    body: JSON.stringify(body),
  });

  const rawText = await res.text();
  let json;
  try {
    json = JSON.parse(rawText);
  } catch {
    throw new Error(`Non-JSON response (${res.status}): ${rawText.slice(0, 400)}`);
  }

  if (!res.ok) {
    throw new Error(
      `HTTP ${res.status} for ${model}: ${JSON.stringify(json).slice(0, 600)}`,
    );
  }

  const data = Array.isArray(json.data) ? json.data : [];
  if (data.length !== texts.length) {
    throw new Error(
      `Expected ${texts.length} embeddings, got ${data.length}. Keys: ${Object.keys(json).join(',')}`,
    );
  }

  // OpenAI order may not match input index — sort by index if present
  const sorted = [...data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return sorted.map((row) => {
    const emb = row.embedding;
    if (!Array.isArray(emb) || emb.length === 0) {
      throw new Error(`Missing embedding array. Row keys: ${Object.keys(row).join(',')}`);
    }
    return emb.map((x) => Number(x));
  });
}

async function validateModel(label, model) {
  console.log('\n' + '='.repeat(72));
  console.log(`MODEL: ${model} (${label})`);
  console.log('='.repeat(72));

  const texts = PAIRS.flatMap((p) => [p.a, p.b]);
  let vectors;
  let encodingTried = 'default';

  try {
    vectors = await embedBatch(model, texts);
  } catch (err) {
    console.log(`default encoding failed: ${err.message}`);
    try {
      encodingTried = 'float';
      vectors = await embedBatch(model, texts, 'float');
      console.log('retry with encoding_format=float succeeded');
    } catch (err2) {
      console.log(`FAIL: API error — ${err2.message}`);
      return { ok: false, model, error: err2.message };
    }
  }

  const meta0 = describeVector(vectors[0]);
  console.log(`encoding_tried: ${encodingTried}`);
  console.log(
    `vector stats (first): dim=${meta0.dim} l2=${meta0.l2.toFixed(6)} `
    + `min=${meta0.min.toFixed(4)} max=${meta0.max.toFixed(4)} `
    + `unitNorm≈${meta0.likelyUnitNormalized} intish=${meta0.looksIntish} `
    + `int8-ish=${meta0.integerRange}`,
  );
  console.log(`sample[0..7]: ${JSON.stringify(meta0.sample)}`);

  const results = [];
  for (let i = 0; i < PAIRS.length; i += 1) {
    const pair = PAIRS[i];
    const va = vectors[i * 2];
    const vb = vectors[i * 2 + 1];
    const sim = cosineSimilarity(va, vb);
    results.push({ ...pair, sim });
    console.log(
      `${pair.kind.padEnd(10)} ${pair.id.padEnd(22)} cosine=${sim.toFixed(6)}`,
    );
  }

  const similarScores = results.filter((r) => r.kind === 'similar').map((r) => r.sim);
  const dissimilarScores = results.filter((r) => r.kind === 'dissimilar').map((r) => r.sim);
  const minSim = Math.min(...similarScores);
  const maxDissim = Math.max(...dissimilarScores);
  const gap = minSim - maxDissim;
  const pass = similarScores.every((s) => dissimilarScores.every((d) => s > d));

  console.log('---');
  console.log(`min(similar)=${minSim.toFixed(6)}  max(dissimilar)=${maxDissim.toFixed(6)}  gap=${gap.toFixed(6)}`);
  console.log(`PASS condition (every similar > every dissimilar): ${pass ? 'YES' : 'NO'}`);

  // Storage estimate
  const dim = meta0.dim;
  const jsonBytesPerFloat = 8; // rough average for JSON numbers
  const perRowKb = (dim * jsonBytesPerFloat) / 1024;
  console.log(
    `storage rough: ${dim}-d × ~${jsonBytesPerFloat}B JSON ≈ ${perRowKb.toFixed(1)} KB/embedding; `
    + `1k digests ≈ ${(perRowKb * 1000 / 1024).toFixed(1)} MB`,
  );

  return {
    ok: pass,
    model,
    dim,
    vectorMeta: meta0,
    results,
    minSim,
    maxDissim,
    gap,
    encodingTried,
  };
}

async function main() {
  const arg = (process.argv[2] || 'both').toLowerCase();
  const order = [];
  if (arg === 'nvidia' || arg === 'both') order.push(['nvidia', MODELS.nvidia]);
  if (arg === 'perplexity' || arg === 'both') order.push(['perplexity', MODELS.perplexity]);
  if (arg === 'openai') order.push(['openai', 'openai/text-embedding-3-small']);

  console.log(`Base URL: ${BASE}`);
  console.log(`Key present: ${API_KEY.slice(0, 8)}…`);

  const outcomes = [];
  for (const [label, model] of order) {
    try {
      outcomes.push(await validateModel(label, model));
    } catch (e) {
      console.log(`UNEXPECTED: ${e.message}`);
      outcomes.push({ ok: false, model, error: e.message });
    }
  }

  console.log('\n' + '#'.repeat(72));
  console.log('SUMMARY');
  for (const o of outcomes) {
    if (o.error && !o.results) {
      console.log(`- ${o.model}: ERROR — ${o.error}`);
    } else {
      console.log(
        `- ${o.model}: ${o.ok ? 'PASS' : 'FAIL'} dim=${o.dim} gap=${o.gap?.toFixed(4)} `
        + `minSim=${o.minSim?.toFixed(4)} maxDissim=${o.maxDissim?.toFixed(4)}`,
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
