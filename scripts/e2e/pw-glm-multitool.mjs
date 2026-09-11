// GLM multi-turn + multi-tool chain probe via Playwriter (robust).
const fs = await importModule('node:fs');
const path = await importModule('node:path');

const BASE = 'http://localhost:8081';
const OUT = path.join(process.cwd(), 'output', 'playwright');
const LOG = path.join(OUT, `pw-glm-multitool-${Date.now()}.log`);
const SHOTS = path.join(OUT, 'pw-glm-shots');
fs.mkdirSync(SHOTS, { recursive: true });

const apiEvents = [];
const agentTelemetry = [];

function log(...parts) {
  const line = parts.join(' ');
  console.log(line);
  fs.appendFileSync(LOG, `${line}\n`, 'utf8');
}

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function dismissOwnershipGate() {
  const yes = state.page.getByRole('button', { name: /Yes, this data is mine/i }).first();
  try {
    if (await yes.isVisible({ timeout: 1200 })) {
      log('dismissing ownership gate: Yes, this data is mine');
      await yes.click();
      await wait(2000);
      return true;
    }
  } catch { /* no gate */ }
  return false;
}

async function forceGlmModel() {
  // Open model picker via header control if present.
  const modelBtn = state.page.getByRole('button', { name: /model|dots|glm|128k|FREE|open model/i }).first();
  try {
    if (await modelBtn.isVisible({ timeout: 1500 })) {
      await modelBtn.click();
      await wait(1500);
    }
  } catch { /* try menu path */ }

  // Prefer any visible GLM option.
  const glmOpt = state.page.getByText(/glm-5\.3-combo/i).first();
  try {
    if (await glmOpt.isVisible({ timeout: 2000 })) {
      log('selecting glm-5.3-combo from picker');
      await glmOpt.click();
      await wait(1500);
      // close sheet if needed
      await state.page.keyboard.press('Escape').catch(() => {});
      return true;
    }
  } catch { /* fall through */ }

  // Fallback: force via storage + reload
  await state.page.evaluate(() => {
    const key = '@blackrose_custom_ai_provider';
    const raw = localStorage.getItem(key);
    const cur = raw ? JSON.parse(raw) : {};
    localStorage.setItem(key, JSON.stringify({
      ...cur,
      selectedModelId: 'glm-5.3-combo',
      freeOnly: false,
      enabled: true,
    }));
  });
  await state.page.reload({ waitUntil: 'domcontentloaded' });
  await wait(6000);
  await dismissOwnershipGate();
  return false;
}

async function attachNetwork() {
  if (state.networkAttached) return;
  state.networkAttached = true;

  state.page.on('console', (msg) => {
    const t = msg.text();
    if (/agent-loop|agent_tool|stream_agent_result|agent_duplicate|agent_max_rounds|toolsRepaired|toolCallSource|prompt-budget.*model|glm|dots/i.test(t)) {
      agentTelemetry.push(t.slice(0, 500));
      log(`[console] ${t.slice(0, 400)}`);
    }
  });

  state.page.on('request', (req) => {
    const url = req.url();
    if (!/100\.107\.7\.52|chat\/completions|:20128/i.test(url)) return;
    let body = null;
    try {
      const post = req.postData();
      if (post) {
        const parsed = JSON.parse(post);
        body = {
          model: parsed.model,
          tools: Array.isArray(parsed.tools) ? parsed.tools.map((t) => t.function?.name || t.name).filter(Boolean) : [],
          messageCount: Array.isArray(parsed.messages) ? parsed.messages.length : 0,
        };
      }
    } catch { /* ignore */ }
    apiEvents.push({ type: 'request', body, ts: Date.now() });
    log(`[net:req] model=${body?.model ?? '?'} toolSpecs=${JSON.stringify(body?.tools ?? [])} msgs=${body?.messageCount ?? '?'}`);
  });

  state.page.on('response', async (res) => {
    const url = res.url();
    if (!/100\.107\.7\.52|chat\/completions|:20128/i.test(url)) return;
    try {
      const text = await res.text();
      const toolNames = [];
      const toolCallChunks = [];
      const sseLines = text.split(/\r?\n/).filter((l) => l.startsWith('data:'));
      const parseMsg = (msg) => {
        if (Array.isArray(msg?.tool_calls)) {
          for (const tc of msg.tool_calls) {
            const name = tc.function?.name || tc.name;
            if (name) toolNames.push(name);
            toolCallChunks.push({ name, args: tc.function?.arguments ?? tc.arguments ?? null });
          }
        }
      };
      if (sseLines.length) {
        for (const line of sseLines) {
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const json = JSON.parse(payload);
            const choice = json.choices?.[0];
            parseMsg(choice?.message || choice?.delta);
          } catch { /* partial */ }
        }
      } else {
        try {
          const json = JSON.parse(text);
          parseMsg(json.choices?.[0]?.message);
        } catch { /* ignore */ }
      }
      apiEvents.push({ type: 'response', status: res.status(), toolNames, toolCallChunks, ts: Date.now() });
      log(`[net:res] status=${res.status()} tools=${JSON.stringify(toolNames)}`);
      if (toolCallChunks.length) log(`[net:tool_calls] ${JSON.stringify(toolCallChunks).slice(0, 900)}`);
    } catch (e) {
      log(`[net:res-err] ${String(e).slice(0, 200)}`);
    }
  });
}

async function closeOverlays() {
  await dismissOwnershipGate();
  for (let i = 0; i < 3; i += 1) {
    const closeMenu = state.page.getByText(/Close menu/i).first();
    try {
      if (await closeMenu.isVisible({ timeout: 400 })) {
        await closeMenu.click({ timeout: 2000 });
        await wait(400);
        continue;
      }
    } catch { /* continue */ }
    break;
  }
}

async function ensureChat() {
  await dismissOwnershipGate();
  let body = await state.page.locator('body').innerText().catch(() => '');
  if (!/Type your thoughts/i.test(body)) {
    log('not on chat input; navigating /chat');
    await state.page.goto(`${BASE}/chat`, { waitUntil: 'domcontentloaded' });
    await wait(6000);
    await dismissOwnershipGate();
    body = await state.page.locator('body').innerText().catch(() => '');
  }
  if (!/Type your thoughts/i.test(body)) {
    // Try Write new entry FAB
    await state.page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await wait(4000);
    await dismissOwnershipGate();
    try {
      await state.page.getByRole('button', { name: /Write new entry/i }).first().click({ timeout: 5000 });
      await wait(1500);
      await state.page.getByText(/^New Entry$/i).first().click({ timeout: 2500 });
      await wait(4000);
    } catch { /* ignore */ }
    await state.page.goto(`${BASE}/chat`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await wait(5000);
    await dismissOwnershipGate();
  }
}

async function typeAndSend(text) {
  await closeOverlays();
  const input = state.page.locator('textarea[placeholder*="Type your thoughts"], input[placeholder*="Type your thoughts"]').first();
  await input.waitFor({ state: 'visible', timeout: 15000 });
  await input.click({ timeout: 5000 }).catch(async () => {
    await state.page.keyboard.press('Escape');
    await wait(300);
    await closeOverlays();
    await input.click({ timeout: 5000 });
  });
  await input.fill('');
  await input.type(text, { delay: 12 });
  await state.page.keyboard.press('Enter');
  log(`sent: ${text}`);
}

async function waitForReply(previousText, timeoutMs) {
  const started = Date.now();
  let lastLen = previousText.length;
  let stableSince = Date.now();
  let sawThinking = false;
  while (Date.now() - started < timeoutMs) {
    const body = await state.page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
    const thinking = /AI is thinking/i.test(body);
    if (thinking) sawThinking = true;
    if (body.length !== lastLen) {
      lastLen = body.length;
      stableSince = Date.now();
    }
    const idle = Date.now() - stableSince;
    const inputBack = await state.page
      .locator('textarea[placeholder*="Type your thoughts"], input[placeholder*="Type your thoughts"]')
      .first()
      .isVisible({ timeout: 300 })
      .catch(() => false);
    // Require: not thinking, input restored, stable 15s, saw thinking at least once OR elapsed > 30s.
    if (!thinking && inputBack && idle > 15000 && (sawThinking || Date.now() - started > 30000) && body.length > previousText.length) {
      // Drain async network handlers before returning.
      await wait(1500);
      return { body, elapsedMs: Date.now() - started, timedOut: false, sawThinking };
    }
    await wait(2500);
  }
  const body = await state.page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
  return { body, elapsedMs: Date.now() - started, timedOut: true, sawThinking };
}

async function waitForInput(timeoutMs = 60000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const input = state.page.locator('textarea[placeholder*="Type your thoughts"], input[placeholder*="Type your thoughts"]').first();
    try {
      if (await input.isVisible({ timeout: 400 })) return true;
    } catch { /* keep waiting */ }
    await wait(1500);
  }
  return false;
}

function extractNew(previous, current) {
  if (current.startsWith(previous)) return current.slice(previous.length).trim().slice(-6000);
  return current.slice(-6000);
}

function toolChainSummary(fromIndex) {
  const events = apiEvents.slice(fromIndex);
  const rounds = events.filter((e) => e.type === 'response' && e.toolNames?.length);
  const names = [];
  for (const r of rounds) for (const n of r.toolNames) names.push(n);
  const reqModels = events.filter((e) => e.type === 'request').map((e) => e.body?.model).filter(Boolean);
  return {
    networkRoundsWithTools: rounds.length,
    toolCallSequence: names,
    uniqueTools: [...new Set(names)],
    multiRound: rounds.length >= 2,
    modelsSeen: [...new Set(reqModels)],
  };
}

// ---- main ----
log('=== playwriter GLM multi-tool multi-turn probe ===');
if (!state.page || state.page.isClosed()) {
  state.page = context.pages().find((p) => p.url().includes('localhost:8081')) ?? context.pages().find((p) => p.url() === 'about:blank') ?? (await context.newPage());
}

await state.page.goto(`${BASE}/chat`, { waitUntil: 'domcontentloaded' });
await wait(6000);
await dismissOwnershipGate();
await forceGlmModel();
await ensureChat();
await attachNetwork();
await closeOverlays();

const body0 = await state.page.locator('body').innerText().catch(() => '');
log(`model banner snippet: ${(body0.match(/glm[^\n]{0,50}|dots[^\n]{0,50}|128k/gi) || []).join(' | ')}`);
log(`pre-turn length=${body0.length}`);
await state.page.screenshot({ path: path.join(SHOTS, '00-chat-ready.png'), scale: 'css' });

const TURNS = [
  { label: 'turn-1-yesterday', text: 'What did I talk about yesterday? Check your tools if needed.', timeoutMs: 180000 },
  { label: 'turn-2-exact-words', text: 'What were my exact words about my boss? Quote me verbatim if you find it.', timeoutMs: 180000 },
  { label: 'turn-3-long-term', text: 'Do you remember when I first started journaling? Use long-term memory tools if useful.', timeoutMs: 180000 },
  { label: 'turn-4-first-chat', text: "What's my very first chat with you? The oldest conversation we ever had. Use tools to look around.", timeoutMs: 240000 },
];

let previous = body0;
const turnReports = [];

for (let i = 0; i < TURNS.length; i += 1) {
  const turn = TURNS[i];
  log(`\n----- ${turn.label} -----`);
  const okInput = await waitForInput(90000);
  if (!okInput) {
    log(`PROBLEM: chat input not available before ${turn.label}`);
    await ensureChat();
  }
  const netStart = apiEvents.length;
  const telStart = agentTelemetry.length;
  try {
    await typeAndSend(turn.text);
  } catch (err) {
    log(`SEND FAIL ${turn.label}: ${String(err).slice(0, 300)}`);
    await ensureChat();
    await wait(5000);
    await typeAndSend(turn.text);
  }
  await wait(5000);
  await state.page.screenshot({ path: path.join(SHOTS, `${i + 1}-thinking.png`), scale: 'css' });
  const settle = await waitForReply(previous, turn.timeoutMs);
  await wait(2000); // drain async net handlers
  const reply = extractNew(previous, settle.body);
  previous = settle.body;
  const chain = toolChainSummary(netStart);
  const tel = agentTelemetry.slice(telStart);
  const dsmlLeak = /DSML|｜｜tool_calls|｜｜invoke/i.test(reply);
  const narrationLeak = /tool_call|recall_memory|get_day\(|list_recent_days/i.test(reply) && !dsmlLeak;
  const verbatimBoss = /The rework\. My boss keeps changing the requirements and I take it out on everyone\./.test(reply);

  log(`elapsedMs=${settle.elapsedMs} timedOut=${settle.timedOut} sawThinking=${settle.sawThinking}`);
  log(`tools multiRound=${chain.multiRound} roundsWithTools=${chain.networkRoundsWithTools} seq=${JSON.stringify(chain.toolCallSequence)} unique=${JSON.stringify(chain.uniqueTools)} models=${JSON.stringify(chain.modelsSeen)}`);
  log(`flags narrationLeak=${narrationLeak} dsmlLeak=${dsmlLeak} verbatimBoss=${verbatimBoss}`);
  log(`TELEMETRY:\n${tel.join('\n')}`);
  log(`REPLY(${turn.label}):\n${reply}\n-----END-----`);
  turnReports.push({ label: turn.label, elapsedMs: settle.elapsedMs, timedOut: settle.timedOut, chain, narrationLeak, dsmlLeak, verbatimBoss, reply });
  await state.page.screenshot({ path: path.join(SHOTS, `${i + 1}-${turn.label}.png`), scale: 'css' });
  if (i < TURNS.length - 1) {
    await waitForInput(60000);
    await wait(25000); // gateway cooldown after 504s
  }
}

log('\n=== AGGREGATE MULTI-TOOL SUMMARY ===');
for (const r of turnReports) {
  log(`${r.label}: multiRound=${r.chain.multiRound} tools=${JSON.stringify(r.chain.toolCallSequence)} models=${JSON.stringify(r.chain.modelsSeen)} dsmlLeak=${r.dsmlLeak} elapsedMs=${r.elapsedMs}`);
}
log(`totalApiEvents=${apiEvents.length}`);
log(`LOG=${LOG}`);
console.log('DONE');
