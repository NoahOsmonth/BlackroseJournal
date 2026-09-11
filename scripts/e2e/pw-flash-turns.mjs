// GLM flash multi-turn via Playwriter CLI. Tool-chain captured from net+console.
if (!state.hooked) {
  state.hooked = true;
  state.log = [];
  state.page.on('console', (m) => {
    const t = m.text();
    if (/agent-loop|agent_tool|stream_agent_result|agent_duplicate|agent_max_rounds|toolsRepaired|toolCallSource/i.test(t)) {
      state.log.push(t.slice(0, 350));
      console.log('[c]', t.slice(0, 300));
    }
  });
  state.page.on('request', (req) => {
    const u = req.url();
    if (!/20128|100\.107\.7\.52/i.test(u)) return;
    try {
      const p = JSON.parse(req.postData() || '{}');
      const tools = (p.tools || []).map((t) => t.function?.name || t.name).filter(Boolean);
      console.log('[req]', p.model, JSON.stringify(tools), 'msgs', (p.messages || []).length);
      state.log.push(`REQ ${p.model} ${JSON.stringify(tools)}`);
    } catch { /* */ }
  });
  state.page.on('response', async (res) => {
    const u = res.url();
    if (!/20128|100\.107\.7\.52/i.test(u)) return;
    try {
      const text = await res.text();
      const names = [];
      for (const line of text.split(/\r?\n/)) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const j = JSON.parse(payload);
          const msg = j.choices?.[0]?.message || j.choices?.[0]?.delta || {};
          for (const tc of msg.tool_calls || []) {
            const n = tc.function?.name || tc.name;
            if (n) names.push(n);
          }
        } catch { /* */ }
      }
      console.log('[res]', res.status(), JSON.stringify(names));
      if (names.length) state.log.push(`RES ${res.status()} ${JSON.stringify(names)}`);
    } catch { /* */ }
  });
}

const turns = [
  'What did I talk about yesterday? Check your tools if needed.',
  'What were my exact words about my boss? Quote me verbatim if you find it.',
  'Do you remember when I first started journaling? Use long-term memory tools if useful.',
  "What's my very first chat with you? The oldest conversation we ever had. Use tools to look around.",
];

async function idle() {
  for (let i = 0; i < 40; i++) {
    const body = await state.page.locator('body').innerText();
    const busy = /AI is thinking|AI typing/i.test(body);
    const inp = await state.page.locator('textarea[placeholder*="Type your thoughts"]').first().isVisible({ timeout: 300 }).catch(() => false);
    if (!busy && inp) return true;
    await new Promise((r) => setTimeout(r, 3000));
  }
  return false;
}

async function sendOne(q, n) {
  console.log('\n==== TURN', n, '====');
  console.log(q);
  await idle();
  const input = state.page.locator('textarea[placeholder*="Type your thoughts"]').first();
  await input.waitFor({ state: 'visible', timeout: 20000 });
  await input.click();
  await input.fill('');
  await input.type(q, { delay: 12 });
  await state.page.keyboard.press('Enter');
  const t0 = Date.now();
  const before = await state.page.locator('body').innerText();
  let saw = false;
  let last = before.length;
  let stable = Date.now();
  while (Date.now() - t0 < 180000) {
    const body = await state.page.locator('body').innerText();
    const busy = /AI is thinking|AI typing/i.test(body);
    if (busy) saw = true;
    if (body.length !== last) { last = body.length; stable = Date.now(); }
    const back = await input.isVisible({ timeout: 250 }).catch(() => false);
    if (!busy && back && Date.now() - stable > 12000 && (saw || Date.now() - t0 > 25000) && body.length > before.length) {
      await new Promise((r) => setTimeout(r, 1500));
      const reply = body.startsWith(before) ? body.slice(before.length) : body.slice(-4500);
      console.log('ELAPSED', Date.now() - t0, 'thinking', saw);
      console.log('REPLY>>>', reply.trim());
      console.log('TOOLS>>>', (state.log || []).join(' | '));
      state.log = [];
      return;
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  console.log('TIMEOUT');
  console.log('TOOLS>>>', (state.log || []).join(' | '));
}

for (let i = 0; i < turns.length; i++) {
  await sendOne(turns[i], i + 1);
  if (i < turns.length - 1) await new Promise((r) => setTimeout(r, 18000));
}
console.log('ALL_DONE');
