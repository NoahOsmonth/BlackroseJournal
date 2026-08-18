/**
 * Recall Q&A probe — runs the 20-question battery against a Hindsight bank and
 * prints the top recall hit + similarity for each, so a memory assessment is
 * grounded in real retrieval, not the LLM's guess.
 *
 * Usage:
 *   HINDSIGHT_BASE_URL=http://100.107.7.52:8890 \
 *     node scripts/hindsight/recall-qa-probe.mjs [--limit N] [--json]
 *
 * The questions are phrased as a user would type them into the app; each maps
 * to a planted needle from populate-memory.mjs so hits are verifiable.
 */
import http from 'node:http';

const BASE_URL = process.env.HINDSIGHT_BASE_URL ?? 'http://localhost:8890';
const BANK = process.env.HINDSIGHT_BANK ?? 'rosebud';
const LIMIT = Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 3);
const AS_JSON = process.argv.includes('--json');

const QUESTIONS = [
  // Long-horizon (1yr)
  { q: 'How did my running journey start? I remember I could barely manage the couch once.', needle: 'running (1yr): couch to 5k' },
  { q: 'When did Priya move abroad? Which city is she in now?', needle: 'priya_van (1yr): Vancouver' },
  { q: 'What was I doing around this time last year?', needle: 'corpus (1yr band)' },
  { q: 'Remind me when I quit caffeine and why.', needle: 'caffeine (6mo): quit for sleep' },
  { q: 'What happened with my dad in June?', needle: 'dad_surgery (6mo): surgery' },
  // Lifestyle facts told once
  { q: 'Do I eat late at night, or did I stop that?', needle: 'negative fact probe' },
  { q: 'What did I decide about caffeine — am I still off it?', needle: 'caffeine (6mo): still off' },
  { q: 'What do I usually do to wind down before bed?', needle: 'habit pattern' },
  // People
  { q: 'Who is Maya to me, and what was her wedding like?', needle: 'wedding (1mo): garden + lavender' },
  { q: 'Tell me about my friend who moved to Canada.', needle: 'priya_van (1yr): Vancouver' },
  { q: 'What do I know about the person who used to own my compass?', needle: 'sailor fact' },
  // Recent (1mo)
  { q: 'Did anything special happen in the last month?', needle: 'wedding + first_5k' },
  { q: 'What was my first 5k time?', needle: 'first_5k (1mo): 34 min' },
  { q: 'How long ago did I run my first 5k?', needle: 'first_5k (1mo): recency' },
  // Mid-horizon (3mo)
  { q: 'When did I move, and where do I live now?', needle: 'nordvik (3mo): moved' },
  { q: 'Which company offered me a job?', needle: 'job_offer (3mo): Brightline' },
  { q: 'What was going on with work three months ago?', needle: 'corpus (3mo band)' },
  // Objects / identity
  { q: "What's the story behind my brass compass — what did I name it?", needle: 'Meridian compass' },
  { q: "Why is the name 'Meridian' special to me?", needle: "Meridian = 'highest point'" },
  // Multi-hop
  { q: 'I want to start running again — when did I train seriously last, and what was my best distance?', needle: 'running (1yr) + first_5k' },
];

function jsonFetch(path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${path}`);
    const payload = JSON.stringify(body);
    const req = http.request(
      url,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(new Error(`bad JSON (${res.statusCode}): ${data.slice(0, 200)}`));
          }
        });
      }
    );
    req.setTimeout(30_000, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end(payload);
  });
}

function flattenResults(data) {
  const record = data ?? {};
  const raw = Array.isArray(data)
    ? data
    : Array.isArray(record.results)
      ? record.results
      : Array.isArray(record.units)
        ? record.units
        : [];
  return raw.map((u) => ({
    text: u.content ?? u.text ?? '',
    sim: u.scores?.final ?? u.similarity ?? 0,
    date: u.occurred_start ?? u.timestamp ?? '',
  }));
}

async function main() {
  const started = Date.now();
  const out = [];
  for (let i = 0; i < QUESTIONS.length; i += 1) {
    const { q, needle } = QUESTIONS[i];
    let data;
    try {
      data = await jsonFetch(`/v1/default/banks/${BANK}/memories/recall`, { query: q, limit: LIMIT });
    } catch (err) {
      out.push({ n: i + 1, q, needle, error: err.message });
      continue;
    }
    const hits = flattenResults(data);
    out.push({ n: i + 1, q, needle, hits: hits.slice(0, LIMIT) });
  }
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  if (AS_JSON) {
    console.log(JSON.stringify({ elapsed, results: out }, null, 2));
    return;
  }

  console.log(`# Recall Q&A probe — ${QUESTIONS.length} questions, ${elapsed}s`);
  console.log(`Bank: ${BANK} @ ${BASE_URL} (limit ${LIMIT}/query)\n`);
  for (const r of out) {
    console.log(`Q${String(r.n).padStart(2, '0')}. ${r.q}`);
    console.log(`   expects: ${r.needle}`);
    if (r.error) {
      console.log(`   ERROR: ${r.error}`);
    } else if (r.hits.length === 0) {
      console.log('   NO HITS');
    } else {
      for (const h of r.hits) {
        const date = h.date ? ` [${String(h.date).slice(0, 10)}]` : '';
        const sim = h.sim >= 0.01 ? h.sim.toFixed(3) : h.sim.toExponential(1);
        console.log(`   ${sim}${date} ${h.text.slice(0, 160)}`);
      }
    }
    console.log('');
  }
}

main().catch((err) => {
  console.error('probe failed:', err);
  process.exit(1);
});
