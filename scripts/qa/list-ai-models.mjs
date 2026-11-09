/**
 * Print every AI option an endpoint actually serves.
 *
 * Written for Kaneo #114: a user fetched with a Google key, saw a model they did not
 * expect, and could not tell which service had answered or what else it offered. The
 * app now shows that in the picker; this prints the raw truth from a terminal.
 *
 *   node scripts/qa/list-ai-models.mjs https://generativelanguage.googleapis.com/v1beta/openai KEY
 *
 * The key is read from the second argument or from AI_KEY in the environment, and is
 * never written anywhere. It is sent only to the address you pass.
 */

const [, , baseArg, keyArg] = process.argv;
const baseUrl = (baseArg || process.env.AI_BASE || '').replace(/\/+$/, '');
const apiKey = keyArg || process.env.AI_KEY || '';

if (!baseUrl || !apiKey) {
    console.error('Usage: node scripts/qa/list-ai-models.mjs <base-url> <access-key>');
    console.error('   or: AI_BASE=... AI_KEY=... node scripts/qa/list-ai-models.mjs');
    process.exit(2);
}

const url = baseUrl + '/models';
console.log('Asking ' + url);

const response = await fetch(url, {
    headers: { Accept: 'application/json', Authorization: 'Bearer ' + apiKey },
}).catch((error) => {
    console.error('Could not reach it: ' + (error instanceof Error ? error.message : String(error)));
    process.exit(1);
});

if (!response.ok) {
    console.error('It answered ' + response.status + ' ' + response.statusText);
    const body = await response.text().catch(() => '');
    if (body) console.error(body.slice(0, 400));
    process.exit(1);
}

const json = await response.json().catch(() => null);
const rows = Array.isArray(json) ? json : json && Array.isArray(json.data) ? json.data : null;
if (!rows) {
    console.error('It answered with something that is not a model list.');
    process.exit(1);
}

const ids = rows.map((row) => (row && typeof row.id === 'string' ? row.id : '')).filter(Boolean).sort();
console.log(rows.length + ' option(s) from ' + baseUrl + ':');
for (const id of ids) console.log('  ' + id);