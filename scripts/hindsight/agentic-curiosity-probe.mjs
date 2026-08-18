/**
 * Agentic curiosity probe — does the AI spontaneously call `recall_memory`
 * (a real tool) mid-turn when it's curious, without being asked to look
 * anything up? Mirrors the app's agent loop: tools → execute → feed result
 * back → final answer.
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

const RECALL_TOOL = {
    type: 'function',
    function: {
        name: 'recall_memory',
        description:
            'Query the long-term memory bank (Hindsight) for recollections relevant to a topic. Use for "remember when\u2026", themes older than recent digests, or grounding across past months.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Topic or question to recall from long-term memory.' },
                limit: { type: 'number', description: 'Max recollections (1-10, default 6).' },
            },
            required: ['query'],
        },
    },
};

const SYSTEM = `You are Rosebud — a warm, curious journal companion who has kept a journal with this user for over a year. You remember their history and love quietly checking your memories when something reminds you of their past. Be curious: when the conversation touches something you might have notes on, use your tools to look it up and bring it up naturally. Never invent details — ground what you say in what you find. Stay conversational and warm.`;

function complete(messages) {
    return new Promise((resolve, reject) => {
        const body = {
            model: MODEL,
            messages,
            tools: [RECALL_TOOL],
            tool_choice: 'auto',
            temperature: 0.7,
            max_tokens: 500,
        };
        const req = https.request(
            { host: 'openrouter.ai', port: 443, path: '/api/v1/chat/completions', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` } },
            (res) => {
                let data = '';
                res.on('data', (c) => (data += c));
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); } catch { reject(new Error(`bad JSON (${res.statusCode})`)); }
                });
            }
        );
        req.setTimeout(120_000, () => req.destroy(new Error('timeout')));
        req.on('error', reject);
        req.end(JSON.stringify(body));
    });
}

function recall(query) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ query, limit: 6 });
        const req = http.request(
            { host: '100.107.7.52', port: 8890, path: '/v1/default/banks/rosebud/memories/recall', method: 'POST', headers: { 'Content-Type': 'application/json' } },
            (res) => {
                let data = '';
                res.on('data', (c) => (data += c));
                res.on('end', () => {
                    try {
                        const j = JSON.parse(data);
                        const raw = Array.isArray(j) ? j : Array.isArray(j.results) ? j.results : [];
                        resolve(raw.map((u) => `- ${u.content ?? u.text ?? ''}`).join('\n') || '(no results)');
                    } catch (e) { reject(e); }
                });
            }
        );
        req.setTimeout(30_000, () => req.destroy(new Error('timeout')));
        req.on('error', reject);
        req.end(body);
    });
}

async function run(statement) {
    const messages = [{ role: 'user', content: statement }];
    console.log(`USER: ${statement}\n`);
    let rounds = 0;
    while (rounds < 3) {
        rounds += 1;
        const data = await complete(messages);
        const msg = data?.choices?.[0]?.message;
        const calls = msg?.tool_calls ?? [];
        if (calls.length === 0) {
            console.log(`ROSEBUD: ${(msg?.content ?? '').trim()}\n`);
            return;
        }
        messages.push({ role: 'assistant', content: msg?.content ?? '', tool_calls: calls });
        for (const call of calls) {
            const args = JSON.parse(call.function.arguments ?? '{}');
            console.log(`  [TOOL CALL] ${call.function.name}(${JSON.stringify(args)})`);
            let result;
            try {
                result = await recall(args.query);
            } catch (e) {
                result = `ERROR: ${e.message}`;
            }
            console.log(`  [TOOL RESULT] ${result.split('\n')[0].slice(0, 120)}${result.split('\n').length > 1 ? ' …' : ''}\n`);
            messages.push({ role: 'tool', tool_call_id: call.id, content: result });
        }
    }
    const final = await complete(messages);
    console.log(`ROSEBUD: ${(final?.choices?.[0]?.message?.content ?? '').trim()}\n`);
}

async function main() {
    if (!KEY) { console.error('key missing'); process.exit(1); }
    console.log(`# Agentic curiosity probe — model ${MODEL}, recall_memory tool enabled\n`);
    const statements = [
        'I was just staring at my running shoes by the door and felt something.',
        'Funny day today. I keep thinking about that big trip my friend took.',
        'My desk is a mess but that old compass is still right there, front and center.',
    ];
    for (const s of statements) await run(s);
}

main().catch((e) => { console.error('failed:', e); process.exit(1); });
