/**
 * Populate the Hindsight memory bank with a deterministic 14-month journal
 * corpus for memory-quality evaluation (1mo / 3mo / 6mo / 1yr horizons).
 * Idempotent by document_id; rerun-safe. Requires a running container.
 *
 * Usage:
 *   HINDSIGHT_BASE_URL=http://localhost:8888 node scripts/hindsight/populate-memory.mjs
 *   HINDSIGHT_BASE_URL=... node scripts/hindsight/populate-memory.mjs --reset
 *
 * NOTE (container v0.9.1): the running container serves the API under the
 * /v1/default/banks/{bank_id} prefix (verified via /openapi.json); the legacy
 * /retain?bank= route is NOT mounted (404). Retain is
 * POST /v1/default/banks/{bank}/memories with items carrying ISO-8601
 * timestamps. Re-retaining the same document_id replaces (update_mode default
 * 'replace'), which is what makes the script idempotent.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

// Per-request client timeout. Sync retain of a 20-item batch runs per-item LLM
// extraction server-side and can take several minutes; undici's default 300s
// headers timeout was killing batches, so the script uses node:http directly.
const REQUEST_TIMEOUT_MS = 15 * 60 * 1000;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE_URL = (process.env.HINDSIGHT_BASE_URL ?? 'http://localhost:8888').replace(/\/+$/, '');
const BANK = process.env.HINDSIGHT_BANK ?? 'rosebud';
const API_KEY = process.env.HINDSIGHT_API_KEY;
// Anchor "today" so buckets are deterministic; override with --as-of YYYY-MM-DD.
const AS_OF = process.env.AS_OF ?? new Date().toISOString().slice(0, 10);

const DAY = 86_400_000;
const asOf = Date.parse(`${AS_OF}T12:00:00Z`);

const BANK_PATH = `/v1/default/banks/${encodeURIComponent(BANK)}`;

/** Needle table: planted offset days before asOf, bucket label, recall query.
 * `distinctive` terms must survive Hindsight's LLM extraction — the container
 * often answers a recall with an auto-extracted unit that carries NO
 * document_id, so the quality battery matches content as a fallback. */
const NEEDLES = [
    { id: 'wedding',     bucket: '1mo',  offsetDays: 21,  query: 'When did Maya get married? What did she wear?', distinctive: ['lavender', 'garden'] },
    { id: 'first_5k',    bucket: '1mo',  offsetDays: 28,  query: 'Did I finish my first 5k run?', distinctive: ['5k', '34'] },
    { id: 'nordvik',     bucket: '3mo',  offsetDays: 70,  query: 'How did the Nordvik interview go?', distinctive: ['nordvik'] },
    { id: 'job_offer',   bucket: '3mo',  offsetDays: 84,  query: 'Which job offer did I accept?', distinctive: ['brightline'] },
    { id: 'dad_surgery', bucket: '6mo',  offsetDays: 168, query: "When was Dad's surgery?", distinctive: ['surgery'] },
    { id: 'caffeine',    bucket: '6mo',  offsetDays: 196, query: 'When did I stop drinking caffeine?', distinctive: ['caffeine'] },
    { id: 'running',     bucket: '1yr',  offsetDays: 336, query: 'When did I start running again?', distinctive: ['couch', '5k'] },
    { id: 'priya_van',   bucket: '1yr',  offsetDays: 392, query: 'When did Priya move abroad?', distinctive: ['vancouver', 'abroad'] },
];

/** Weekly-topic calendar: day index (negative offset) -> topic + detail. */
function topicForOffset(offsetDays) {
    const w = Math.floor(offsetDays / 7);
    const day = offsetDays % 7;
    const topics = [
        'Work felt heavy this week; I keep replaying the all-hands.',
        'Had dinner with Maya and we talked about her plans.',
        'Ran in the morning for the first time in weeks.',
        'Could not sleep; woke at 3am worrying about money.',
        'Called Priya; she had just finished a pottery class.',
        'Felt calm today. Made tea, read, went for a walk.',
        'Therapy session: we talked about boundaries with Dad.',
    ];
    return topics[(w + day) % topics.length];
}

function buildEntries() {
    const entries = [];
    // One entry every ~3 days over 14 months (max 60 entries, deterministic).
    for (let offset = 14 * 30; offset >= 1; offset -= 3) {
        const ts = asOf - offset * DAY;
        entries.push({
            id: `corpus_${ts}`,
            timestamp: ts,
            content: `Journal entry ${new Date(ts).toISOString().slice(0, 10)}\n${topicForOffset(offset)}`,
        });
    }
    // Plant the 8 needles (they carry the distinct facts probes query for).
    for (const needle of NEEDLES) {
        const ts = asOf - needle.offsetDays * DAY;
        entries.push({ id: `needle_${needle.id}`, timestamp: ts, content: needleContent(needle) });
    }
    entries.sort((a, b) => a.timestamp - b.timestamp);
    return entries;
}

function needleContent(needle) {
    const when = new Date(asOf - needle.offsetDays * DAY).toISOString().slice(0, 10);
    const body = {
        wedding:     `Maya got married today, ${when}. The ceremony was in her parents' garden and she wore a lavender dress. I cried during the vows.`,
        first_5k:    `I finished my first 5k today, ${when}! Ran it in 34 minutes. My legs hurt but I feel proud.`,
        nordvik:     `The Nordvik interview was today, ${when}. Panel of three, one system design question. I think it went well but I am nervous about the technical round.`,
        job_offer:   `I accepted the fintech support role at Brightline today, ${when}. More money, better hours, hybrid.`,
        dad_surgery: `Dad had his knee surgery this morning, ${when}. The doctors said it went well. He is resting at home now.`,
        caffeine:    `Day 1 without caffeine, ${when}. Headache all afternoon but I am doing this for my sleep.`,
        running:     `I started running again today, ${when}. Couch to 5k week one. I want to do a 10k by the end of the year.`,
        priya_van:   `Priya moved abroad to Vancouver today, ${when}. Her flight left at 7am. I am going to visit in the spring.`,
    }[needle.id];
    return body ?? 'Unused';
}

async function jsonFetch(path, init) {
    const method = init.method ?? 'GET';
    const body = init.body ?? null;
    const url = new URL(`${BASE_URL}${path}`);
    const send = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const result = await new Promise((resolve, reject) => {
        const req = send(
            url,
            {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
                    ...(init.headers ?? {}),
                },
            },
            (res) => {
                let data = '';
                res.setEncoding('utf8');
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    resolve({ status: res.statusCode ?? 0, text: data });
                });
            }
        );
        req.setTimeout(REQUEST_TIMEOUT_MS, () => req.destroy(new Error(`${path} timed out after ${REQUEST_TIMEOUT_MS}ms`)));
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
    if (result.status < 200 || result.status >= 300) {
        throw new Error(`${path} -> ${result.status}: ${result.text}`);
    }
    return result.text ? JSON.parse(result.text) : null;
}

/** Create the bank if it does not exist (PUT is an idempotent upsert). */
async function ensureBank() {
    await jsonFetch(BANK_PATH, { method: 'PUT', body: '{}' });
    console.log(`[bank] ensured ${BANK}`);
}

async function main() {
    if (process.argv.includes('--reset')) {
        // Hindsight exposes bank deletion via DELETE; if unavailable in this
        // version, instruct: docker stop/rm -v the container volume and restart.
        try {
            await jsonFetch(BANK_PATH, { method: 'DELETE' });
            console.log(`[reset] deleted bank ${BANK}`);
        } catch (err) {
            console.warn(`[reset] could not delete bank (${err.message}); recreate the container volume to reset.`);
        }
    }
    await ensureBank();

    const entries = buildEntries();
    const batchSize = 20;
    let retained = 0;
    for (let i = 0; i < entries.length; i += batchSize) {
        const items = entries.slice(i, i + batchSize).map((e) => ({
            content: e.content,
            // Container v0.9.1 requires ISO-8601 timestamps (epoch ms is 422).
            timestamp: new Date(e.timestamp).toISOString(),
            document_id: e.id,
        }));
        await jsonFetch(`${BANK_PATH}/memories`, {
            method: 'POST',
            body: JSON.stringify({ items }),
        });
        retained += items.length;
        console.log(`[retain] ${retained}/${entries.length}`);
    }

    const needles = NEEDLES.map((n) => ({
        needleId: n.id,
        bucket: n.bucket,
        query: n.query,
        documentId: `needle_${n.id}`,
        plantedAt: new Date(asOf - n.offsetDays * DAY).toISOString(),
        distinctive: n.distinctive,
    }));
    const outDir = join(ROOT, 'probes', 'artifacts');
    mkdirSync(outDir, { recursive: true });
    const indexPath = join(outDir, 'hindsight-needles.json');
    writeFileSync(indexPath, JSON.stringify({ asOf: AS_OF, bank: BANK, needles }, null, 2));
    console.log(`[done] ${retained} entries retained; needles -> ${indexPath}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
