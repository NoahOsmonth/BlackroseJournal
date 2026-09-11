// One multi-turn GLM probe via Playwriter CLI (-f).
const turns = [
  'What did I talk about yesterday? Check your tools if needed.',
  'What were my exact words about my boss? Quote me verbatim if you find it.',
  'Do you remember when I first started journaling? Use long-term memory tools if useful.',
  "What's my very first chat with you? The oldest conversation we ever had. Use tools to look around.",
];

// network + console hook
if (!state.netHooked) {
  state.netHooked = true;
  state.toolLog = [];
  state.page.on('console', (msg) => {
    const t = msg.text();
    if (/agent-loop|agent_tool|stream_agent_result|agent_duplicate|agent_max_rounds|toolsRepaired|toolCallSource|glm|dots/i.test(t)) {
      state.toolLog.push(t.slice(0, 400));
      console.log('[console]', t.slice(0, 350));
    }
  });
  state.page.on('request', (req) => {
    const url = req.url();
    if (!/20128|chat\/completions|100\.107\.7\.52/i.test(url)) return;
    try {
      const post = req.postData();
      const parsed = post ? JSON.parse(post) : null;
      const tools = parsed?.tools?.map((t) => t.function?.name || t.name).filter(Boolean) || [];
      console.log('[req]', parsed?.model ?? '?', 'tools=', JSON.stringify(tools), 'msgs=', parsed?.messages?.length ?? 0);
      state.toolLog.push(`REQ ${parsed?.model} ${JSON.stringify(tools)} msgs=${parsed?.messages?.length ?? 0}`);
    } catch { /* ignore */ }
  });
  state.page.on('response', async (res) => {
    const url = res.url();
    if (!/20128|chat\/completions|100\.107\.7\.52/i.test(url)) return;
    try {
      const text = await res.text();
      const names = [];
      for (const line of text.split(/\r?\n/)) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const json = JSON.parse(payload);
          const msg = json.choices?.[0]?.message || json.choices?.[0]?.delta || {};
          if (Array.isArray(msg.tool_calls)) {
            for (const tc of msg.tool_calls) {
              const name = tc.function?.name || tc.name;
              if (name) names.push(name);
            }
          }
        } catch { /* partial */ }
      }
      console.log('[res]', res.status(), 'tools=', JSON.stringify(names));
      if (names.length) state.toolLog.push(`RES ${res.status()} ${JSON.stringify(names)}`);
    } catch { /* ignore */ }
  });
}

async function sendOne(q, idx) {
  console.log('\n==== TURN', idx, '====');
  console.log('SEND', q);
  const input = state.page.locator('textarea[placeholder*="Type your thoughts"], input[placeholder*="Type your thoughts"]').first();
  await input.waitFor({ state: 'visible', timeout: 30000 });
  await input.click();
  await input.fill('');
  await input.type(q, { delay: 15 });
  await state.page.keyboard.press('Enter');
  const started = Date.now();
  const before = await state.page.locator('body').innerText();
  let sawThinking = false;
  let lastLen = before.length;
  let stableSince = Date.now();
  while (Date.now() - started < 200000) {
    const body = await state.page.locator('body').innerText();
    const thinking = /AI is thinking|AI typing/i.test(body);
    if (thinking) sawThinking = true;
    if (body.length !== lastLen) {
      lastLen = body.length;
      stableSince = Date.now();
    }
    const inputBack = await input.isVisible({ timeout: 300 }).catch(() => false);
    const idle = Date.now() - stableSince;
    if (!thinking && inputBack && idle > 14000 && (sawThinking || Date.now() - started > 30000) && body.length > before.length) {
      await new Promise((r) => setTimeout(r, 2000));
      const reply = body.startsWith(before) ? body.slice(before.length) : body.slice(-4500);
      console.log('ELAPSED_MS', Date.now() - started, 'sawThinking', sawThinking);
      console.log('REPLY_START');
      console.log(reply.trim());
      console.log('REPLY_END');
      console.log('TOOLLOG_START');
      console.log((state.toolLog || []).join('\n'));
      console.log('TOOLLOG_END');
      state.toolLog = [];
      return;
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  console.log('TIMEOUT turn', idx);
  console.log('TOOLLOG_START');
  console.log((state.toolLog || []).join('\n'));
  console.log('TOOLLOG_END');
}

// Wait for idle first
for (let i = 0; i < 40; i++) {
  const body = await state.page.locator('body').innerText();
  const thinking = /AI is thinking|AI typing/i.test(body);
  const input = await state.page.locator('textarea[placeholder*="Type your thoughts"]').first().isVisible({ timeout: 300 }).catch(() => false);
  if (!thinking && input) break;
  await new Promise((r) => setTimeout(r, 3000));
}

for (let i = 0; i < turns.length; i += 1) {
  await sendOne(turns[i], i + 1);
  if (i < turns.length - 1) await new Promise((r) => setTimeout(r, 20000));
}
console.log('ALL_DONE');
