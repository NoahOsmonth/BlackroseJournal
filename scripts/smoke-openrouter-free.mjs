/**
 * One-off live smoke for OpenRouter free models.
 * Reads key from local .env (gitignored). Does not print the key.
 */
import fs from 'node:fs';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), '.env');
const envText = fs.readFileSync(envPath, 'utf8');
const key = envText.match(/^EXPO_PUBLIC_NANO_GPT_API_KEY=(.+)$/m)?.[1]?.trim();
if (!key || key.startsWith('YOUR_')) {
    console.error('Missing OpenRouter key in .env');
    process.exit(1);
}

const headers = {
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://blackrosejournal.app',
    'X-Title': 'Blackrose Journal',
};

const isFree = (id) => {
    const n = String(id).toLowerCase();
    return n.includes(':free') || n === 'openrouter/free';
};

const modelsRes = await fetch('https://openrouter.ai/api/v1/models', { headers });
if (!modelsRes.ok) {
    console.error('models status', modelsRes.status, await modelsRes.text());
    process.exit(1);
}
const modelsJson = await modelsRes.json();
const all = Array.isArray(modelsJson.data) ? modelsJson.data : [];
const free = all.filter((m) => isFree(m.id));
console.log('total_models', all.length);
console.log('free_models', free.length);
console.log('sample_free', free.slice(0, 8).map((m) => m.id).join(', '));

const preferred = free.find((m) => m.id === 'dots-studio/dots-3-note-preview:free') ?? free[0];
if (!preferred) {
    console.error('No free models available');
    process.exit(1);
}
console.log('using_model', preferred.id);

const chatRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
        model: preferred.id,
        messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
        max_tokens: 16,
    }),
});
const chatJson = await chatRes.json();
if (!chatRes.ok || chatJson.error) {
    console.error('chat_failed', chatRes.status, JSON.stringify(chatJson.error || chatJson));
    process.exit(1);
}
const content = chatJson.choices?.[0]?.message?.content ?? '';
console.log('chat_status', chatRes.status);
console.log('chat_model', chatJson.model ?? preferred.id);
console.log('chat_content_preview', String(content).slice(0, 80));
console.log('smoke_ok', true);
