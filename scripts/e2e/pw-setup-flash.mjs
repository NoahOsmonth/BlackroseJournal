// Seed a v2 provider profile and open chat (Playwriter CLI -f).
// Reads the endpoint from the environment — no host, key or model is hardcoded.
const BASE_URL = (process.env.EXPO_PUBLIC_AI_CUSTOM_BASE ?? '').trim();
const API_KEY = (process.env.EXPO_PUBLIC_AI_CUSTOM_API_KEY ?? '').trim();
const MODEL_ID = (process.env.EXPO_PUBLIC_AI_CUSTOM_MODEL ?? '').trim();
if (!BASE_URL || !API_KEY || !MODEL_ID) {
  throw new Error(
    'Set EXPO_PUBLIC_AI_CUSTOM_BASE / _API_KEY / _MODEL (e.g. in .env) before running this probe.',
  );
}

const profile = {
  id: 'p_probe',
  label: 'Probe provider',
  baseUrl: BASE_URL,
  apiKey: API_KEY,
  selectedModelId: MODEL_ID,
  flashModelId: null,
  models: [{ id: MODEL_ID, contextWindow: 128000, contextWindowSource: 'fallback' }],
  recentModelIds: [MODEL_ID],
  modelFilterPatterns: [],
  fallbackModelIds: [],
  contextWindowOverride: null,
  fallbackContextWindow: 128000,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};
const settings = {
  schemaVersion: 2,
  enabled: true,
  activeProfileId: profile.id,
  profiles: [profile],
  updatedAt: Date.now(),
};

await state.page.goto('http://localhost:8081/chat', { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 4000));
await state.page.evaluate((record) => {
  localStorage.setItem('@blackrose_custom_ai_provider', JSON.stringify(record));
}, settings);
await state.page.reload({ waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 7000));
// dismiss ownership gate if present
try {
  const yes = state.page.getByRole('button', { name: /Yes, this data is mine/i });
  if (await yes.isVisible({ timeout: 1500 })) {
    await yes.click();
    await new Promise((r) => setTimeout(r, 2000));
  }
} catch { /* none */ }
console.log('URL', state.page.url());
console.log(await snapshot({ page: state.page, search: /Type your thoughts|Keep your journal/i, showDiffSinceLastCall: false }));
console.log(await getLatestLogs({ page: state.page, sinceLastCall: true, count: 15 }));
