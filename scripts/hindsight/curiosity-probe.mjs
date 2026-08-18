/**
 * Curiosity probe — does the AI volunteer a related past memory when the user
 * talks about a topic, WITHOUT asking about the past?
 *
 * Same pipeline as the app: recall on the user message → context block → LLM.
 * Statements only, no questions about history.
 */
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const envText = fs.existsSync(path.join(ROOT, '.env')) ? fs.readFileSync(path.join(ROOT, '.env'), 'utf8') : '';
const env = {};
for (const line of envText.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
}
const KEY = env.EXPO_PUBLIC_NANO_GPT_API_KEY;
const MODEL = env.EXPO_PUBLIC_NANO_GPT_MODEL ?? 'dots-studio/dots-3-note-preview:free';

// Conversational statements — no "do you remember..." wording.
const STATEMENTS = [
    'Thinking about getting back into running this weekend.',
    'Coffee is really not helping me sleep lately.',
    'Been up at 3am the last few nights worrying about money.',
    'My friend keeps talking about moving to another country.',
    'I have a wedding to go to next month, need to pick an outfit.',
    'That old compass on my desk, I look at it every day.',
];

function jsonFetch(opts) {
    return new Promise((resolve, reject) => {
        const lib = opts.https ? https : http;
        const payload = JSON.stringify(opts.body);
        const req = lib.request(
            { host: opts.host, port: opts.port, path: opts.path, method: 'POST', headers: { 'Content-Type': 'application/json', ...(opts.https ? { Authorization: `Bearer ${KEY}` } : {}) } },
            (res) => {
                let data = '';
                res.on('data', (c) => (data += c));
                res.on('end', () => {
                    try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
                    catch { reject(new Error(`bad JSON (${res.statusCode}): ${data.slice(0, 160)}`)); }
                });
            }
        );
        req.setTimeout(opts.https ? 120_000 : 30_000, () => req.destroy(new Error('timeout')));
        req.on('error', reject);
        req.end(payload);
    });
}

async function recall(query) {
    const { data } = await jsonFetch({ host: '100.107.7.52', port: 8890, path: '/v1/default/banks/rosebud/memories/recall', body: { query, limit: 6 } });
    const raw = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
    return raw.map((u) => ({
        text: u.content ?? u.text ?? '',
        sim: u.scores?.final ?? u.similarity ?? 0,
        date: u.occurred_start ?? '',
    }));
}

function contextBlock(statement, hits) {
    const lines = hits
        .filter((h) => h.text)
        .map((h) => {
            const sim = h.sim >= 0.01 ? h.sim.toFixed(2) : h.sim.toExponential(1);
            const date = h.date ? ` (Written ${String(h.date).slice(0, 10)})` : '';
            return `- sim=${sim} ${h.text}${date}`;
        });
    return [
        '## Relevant long-term context',
        'Long-term recollections from the user\u2019s past entries. Use these facts when they relate; never invent details beyond them.',
        ...lines,
    ].join('\n');
}

const PROMPT_FILE = path.join(ROOT, 'constants', 'rosebudCompanionPrompt.ts');
const PROMPT_SRC = fs.readFileSync(PROMPT_FILE, 'utf8');
const PROMPT_MATCH = PROMPT_SRC.match(/ROSEBUD_COMPANION_SYSTEM_PROMPT = `([\s\S]*?)`\n/);
const REAL_SYSTEM = PROMPT_MATCH ? PROMPT_MATCH[1] : 'You are a warm journal companion.';

async function run(statement) {
    const hits = await recall(statement);
    const context = contextBlock(statement, hits);
    const { data } = await jsonFetch({
        https: true, host: 'openrouter.ai', port: 443, path: '/api/v1/chat/completions',
        body: {
            model: MODEL,
            messages: [
                { role: 'system', content: REAL_SYSTEM },
                { role: 'user', content: `${context}\n\n${statement}` },
            ],
            temperature: 0.7,
            max_tokens: 400,
        },
    });
    const answer = data?.choices?.[0]?.message?.content ?? '(no answer)';
    console.log(`USER: ${statement}`);
    console.log(`  recall: ${hits.slice(0, 3).map((h) => `"${h.text.slice(0, 80)}"`).join(' | ') || '(none)'}`);
    console.log(`ROSEBUD: ${answer.trim()}\n`);
}

async function main() {
    if (!KEY) { console.error('key missing'); process.exit(1); }
    console.log(`# Curiosity probe — model ${MODEL}\n`);
    for (const s of STATEMENTS) await run(s);
}

main().catch((e) => { console.error('failed:', e); process.exit(1); });
