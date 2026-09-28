/**
 * Rendered-surface gate for the chat redesign.
 *
 * What it proves, and why it is shaped this way:
 * - The changed surface is the chat transcript + its work layer (reasoning, tool
 *   calls) + the pinned composer. So every probe measures *that*, at three
 *   representative viewports and in BOTH schemes.
 * - Playwright's `colorScheme` emulation is a no-op for NativeWind / RN-web, so the
 *   scheme is driven through the app's own persisted preference and then asserted
 *   to have taken: the root class must differ AND the two captures must hash
 *   differently. Identical hashes mean one thing was tested twice.
 * - Every probe is guarded with an explicit non-zero count. A selector that matches
 *   nothing fails the run instead of skipping its assertions and printing green.
 * - Presence only proves markup, so the run also *interacts*: it expands the work
 *   layer, collapses it, throws the header switch off (asserting the work layer and
 *   the reasoning are then ABSENT without ever expanding them), and types into the
 *   slip to prove the send wiring.
 *
 * Run: node scripts/e2e/pw-chat-surface-verify.mjs      (Expo web must serve :8081)
 * Env: E2E_BASE_URL=http://localhost:8081
 *      E2E_HEADLESS=0        watch it
 *      E2E_SABOTAGE=1        inject a fake mic + push the composer off-screen and
 *                            require the matching guards to go RED (a guard that
 *                            cannot fail is not evidence)
 *
 * Test scaffolding is browser storage only: no app code is modified.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:8081';
const HEADLESS = process.env.E2E_HEADLESS !== '0';
const SABOTAGE = process.env.E2E_SABOTAGE === '1';
const OUT_DIR = path.join(process.cwd(), 'output', 'playwright');
const STAMP = Date.now();

/** Fixed device-local account so account-scoped keys are stable across runs. */
const ACCOUNT_ID = 'e2e-local-account';
const SESSION_ID = 'e2e-work-layer';

/** The prompt is written once, as the slip's own default (see chatPresentation). */
const PLACEHOLDER = "Write what's true…";
const REPLY_PREFIX = 'Three times this month';

/** Distinctive prose so a "turn is present" check cannot match app chrome. */
const SEED_TURNS = [
    "I keep saying I'll go to bed early",
    REPLY_PREFIX,
    "it's not the work",
    "I'm good",
    'Good. I will leave the bedtime thread',
];

const SEED_TOOLS = [
    { toolCallId: 'c1', name: 'get_clock', label: 'Checking the time', argsPreview: 'local', status: 'ok', durationMs: 96, resultPreview: 'Sun 22:41', round: 1, origin: 'structured' },
    { toolCallId: 'c2', name: 'list_recent_days', label: 'Listing your recent days', argsPreview: 'last 7 days', status: 'ok', durationMs: 412, resultPreview: '7 days · sleep on 4', round: 1, origin: 'structured' },
    { toolCallId: 'c3', name: 'memory_search', label: 'Searching your memory files', argsPreview: 'bedtime late night', status: 'ok', durationMs: 268, resultPreview: '2 files matched', round: 2, origin: 'structured' },
];

/**
 * The seeded strings live inline inside `seedStorage` below, not in module
 * constants: `addInitScript` serialises the function's source into the page, so it
 * cannot close over anything from this module.
 */
const SIZES = [
    { name: 'mobile-390x844', width: 390, height: 844 },
    { name: 'reference-360x800', width: 360, height: 800 },
    { name: 'desktop-1440x900', width: 1440, height: 900 },
];
const SCHEMES = ['dark', 'light'];

const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16);

/** Seed function runs before every document, so a reload cannot lose the state. */
function seedStorage({ accountId, theme }) {
    const session = {
        conversationId: 'e2e-work-layer',
        mode: 'freeform',
        createdAt: Date.now() - 120000,
        updatedAt: Date.now(),
        messages: [
            { id: 'm1', role: 'user', content: "I keep saying I'll go to bed early and then it's 1am again.", timestamp: Date.now() - 115000 },
            {
                id: 'm2',
                role: 'assistant',
                timestamp: Date.now() - 110000,
                reasoning:
                    'Third time this month. Before I answer, check what the last week actually looked like — if the late nights cluster on work days this is a different story than a habit problem.',
                content:
                    'Three times this month, and each time it arrives the same way — as a plan you make in daylight and then hand to a version of you at midnight who never agreed to it.',
                toolActivity: [
                    { toolCallId: 'c1', name: 'get_clock', label: 'Checking the time', argsPreview: 'local', status: 'ok', durationMs: 96, resultPreview: 'Sun 22:41', round: 1, origin: 'structured' },
                    { toolCallId: 'c2', name: 'list_recent_days', label: 'Listing your recent days', argsPreview: 'last 7 days', status: 'ok', durationMs: 412, resultPreview: '7 days · sleep on 4', round: 1, origin: 'structured' },
                    { toolCallId: 'c3', name: 'memory_search', label: 'Searching your memory files', argsPreview: 'bedtime late night', status: 'ok', durationMs: 268, resultPreview: '2 files matched', round: 2, origin: 'structured' },
                ],
            },
            { id: 'm3', role: 'user', content: "it's not the work. it's that the night is the only part of the day nobody asks me for anything", timestamp: Date.now() - 60000 },
            {
                id: 'm4',
                role: 'assistant',
                timestamp: Date.now() - 55000,
                reasoning: "That is the real thread, and it is not a sleep problem. Don't hand her a fix; she just told me the night is hers.",
                content:
                    "So the late hour is not the failure — it is the part of the day that belongs to you. That makes 'go to bed earlier' a strange thing to ask of yourself, since you would be asking yourself to give that up.",
            },
            { id: 'm5', role: 'user', content: "I'm good", timestamp: Date.now() - 20000 },
            { id: 'm6', role: 'assistant', content: 'Good. I will leave the bedtime thread where it is then.', timestamp: Date.now() - 15000 },
        ],
    };

    const scoped = (key) => `@blackrose_account:v1:${encodeURIComponent(accountId)}:${key}`;
    localStorage.setItem(
        '@blackrose_account_registry',
        JSON.stringify({
            // Without the schemaVersion envelope parseRegistry() returns an empty
            // registry and the app mints a NEW account, orphaning the seeded keys.
            schemaVersion: 1,
            rememberedAccountId: accountId,
            accounts: { [accountId]: { id: accountId, email: null, lastAuthenticatedAt: Date.now() } },
        })
    );
    localStorage.setItem(scoped('blackrose_chat_sessions'), JSON.stringify([session]));
    // Dev-only demo seed would add unrelated entries; keep the surface clean.
    localStorage.setItem(scoped('demo_data_seeded'), 'true');
    // The app's own theme preference, read on boot by useThemeSettings.
    localStorage.setItem('user-theme-preference', theme);
}

/**
 * One probe, all DOM facts. Returns raw numbers plus the element counts that make
 * a zero-match visible instead of silently true.
 */
const PROBE = `(() => {
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const all = (s) => Array.from(document.querySelectorAll(s));
  const rect = (el) => { const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
             left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom) }; };
  const leafStartingWith = (p) => all('div,span').find((e) => e.children.length === 0 && e.textContent.trim().startsWith(p)) || null;
  const buttons = all('[role="button"]');
  const byText = (t) => buttons.find((b) => (b.textContent || '').trim() === t) || null;

  const slip = document.querySelector('textarea');
  const rails = all('div').filter((e) => e.offsetWidth === 1 && e.offsetHeight > 20);
  const reasoning = document.querySelector('[aria-label="Companion reasoning"]');
  const writer = leafStartingWith("I keep saying");
  const reply = leafStartingWith(${JSON.stringify(REPLY_PREFIX)});
  const finish = byText('Finish entry');
  const deeper = byText('Go deeper');
  const iconButtons = buttons.filter((b) => {
    const l = b.getAttribute('aria-label') || '';
    return l === 'Attach a photo' || l === 'Read the last reply aloud';
  });

  return {
    vw, vh,
    htmlClass: document.documentElement.className || '(none)',
    docOverflowX: document.documentElement.scrollWidth - vw,
    slipCount: all('textarea').length,
    placeholder: slip ? slip.placeholder : null,
    slipValue: slip ? slip.value : null,
    workLayerCount: all('[aria-label="Tool activity"]').length,
    toolRowLabels: all('[aria-label]').map((e) => e.getAttribute('aria-label'))
      .filter((l) => /^Tool .+: (ok|error|refused|running)$/.test(l)),
    reasoningCount: reasoning ? 1 : 0,
    reasoningColor: reasoning ? getComputedStyle(reasoning).color : null,
    reasoningFontStyle: reasoning ? getComputedStyle(reasoning).fontStyle : null,
    summaryText: (document.body.innerText.match(/Thought it through[^\\n]*/) || [null])[0],
    writerLeft: writer ? rect(writer).left : null,
    replyLeft: reply ? rect(reply).left : null,
    reasoningLeft: reasoning ? rect(reasoning).left : null,
    railLeft: rails.length ? rect(rails[0]).left : null,
    railColor: rails.length ? getComputedStyle(rails[0]).backgroundColor : null,
    iconButtonLabels: iconButtons.map((b) => b.getAttribute('aria-label')),
    micLabels: all('[aria-label]').map((e) => e.getAttribute('aria-label'))
      .filter((l) => /microphone|\\bmic\\b/i.test(l)),
    finishRect: finish ? rect(finish) : null,
    deeperRect: deeper ? rect(deeper) : null,
    deeperDisabled: deeper ? deeper.getAttribute('aria-disabled') : null,
    deeperOpacity: deeper ? getComputedStyle(deeper).opacity : null,
    turnsFound: ${JSON.stringify(SEED_TURNS)}.filter((t) => document.body.innerText.includes(t)).length,
    // Attributes never appear in innerText: scan them explicitly.
    attributeCorpus: all('[aria-label],[placeholder]')
      .map((e) => (e.getAttribute('aria-label') || '') + ' ' + (e.getAttribute('placeholder') || '')).join(' | '),
  };
})()`;

/** Names of the guards that fired, for a readable failure list. */
function evaluate(label, m, expected) {
    const failures = [];
    const fail = (msg) => failures.push(`${label}: ${msg}`);

    // --- zero-match guards: a probe that matched nothing must fail loudly ---
    if (m.slipCount !== 1) fail(`slip probe matched ${m.slipCount} textareas (expected 1)`);
    if (m.turnsFound < 5) fail(`only ${m.turnsFound}/5 seeded turns rendered — the transcript did not load`);
    if (m.workLayerCount < 1) fail(`work-layer probe matched 0 [aria-label="Tool activity"] nodes`);
    if (!m.finishRect || !m.deeperRect) fail('composer verb probe matched no buttons');
    if (m.iconButtonLabels.length !== 2) fail(`composer icon probe matched ${m.iconButtonLabels.length} buttons (expected 2)`);

    // --- the composer must be fully on screen, in every size ---
    for (const [name, r] of [['Finish entry', m.finishRect], ['Go deeper', m.deeperRect]]) {
        if (!r) continue;
        if (r.bottom > m.vh) fail(`${name} is clipped: bottom ${r.bottom} > viewport ${m.vh}`);
        if (r.right > m.vw) fail(`${name} overflows horizontally: right ${r.right} > viewport ${m.vw}`);
        if (r.left < 0) fail(`${name} starts off-screen at x ${r.left}`);
    }
    if (m.docOverflowX > 1) fail(`page overflows horizontally by ${m.docOverflowX}px`);

    // --- the design: writer flush, companion behind the bone rule ---
    if (m.railLeft === null) fail('no 1px bone rail found for the companion turn');
    if (m.writerLeft !== null && m.railLeft !== null && Math.abs(m.writerLeft - m.railLeft) > 1) {
        fail(`rail is not at the writer's margin: rail ${m.railLeft} vs writer ${m.writerLeft}`);
    }
    if (m.replyLeft !== null && m.writerLeft !== null && m.replyLeft <= m.writerLeft) {
        fail(`companion reply is not indented: reply ${m.replyLeft} vs writer ${m.writerLeft}`);
    }

    // --- the work layer is state-dependent: collapsed shows only the summary line,
    // expanded adds the reasoning nested inside the reply. Asserting the expanded
    // facts while collapsed is a harness bug, not an app defect. ---
    if (expected.state === 'collapsed') {
        if (m.reasoningCount !== 0) {
            fail('the collapsed work layer is rendering its reasoning — the summary line should be the only trace');
        }
    } else {
        if (m.reasoningCount !== 1) fail('reasoning is not rendered when expanded');
        if (m.reasoningFontStyle !== 'italic') fail(`reasoning is not italic (${m.reasoningFontStyle})`);
        if (m.reasoningLeft !== null && m.replyLeft !== null && m.reasoningLeft <= m.replyLeft) {
            fail(`reasoning is not nested inside the reply: reasoning ${m.reasoningLeft} vs reply ${m.replyLeft}`);
        }
    }

    // --- the copy: prompt lives in the attribute, so scan the attribute corpus ---
    if (m.placeholder !== PLACEHOLDER) fail(`slip placeholder is ${JSON.stringify(m.placeholder)}`);
    if (!m.attributeCorpus.includes(PLACEHOLDER)) fail('placeholder is missing from the attribute corpus');

    // --- no microphone anywhere: the request was to remove it ---
    if (m.micLabels.length > 0) fail(`microphone control still present: ${JSON.stringify(m.micLabels)}`);

    // --- the scheme actually changed ---
    const wantClass = expected.scheme === 'dark' ? 'dark' : '(none)';
    if (m.htmlClass !== wantClass) fail(`theme did not take: root class ${m.htmlClass}, wanted ${wantClass}`);

    return failures;
}

async function run() {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const browser = await chromium.launch({ headless: HEADLESS });
    const results = [];
    const hashes = new Map();
    let failures = [];
    let sabotageHits = [];

    for (const size of SIZES) {
        for (const scheme of SCHEMES) {
            const label = `${size.name}/${scheme}`;
            const context = await browser.newContext({
                viewport: { width: size.width, height: size.height },
                deviceScaleFactor: 1,
            });
            await context.addInitScript(seedStorage, { accountId: ACCOUNT_ID, theme: scheme });
            const page = await context.newPage();
            const consoleErrors = [];
            page.on('pageerror', (e) => consoleErrors.push(String(e.message)));

            await page.goto(`${BASE}/chat?resume=${SESSION_ID}`, { waitUntil: 'domcontentloaded' });
            // Hydration is async (account -> session load); wait on a seeded fact.
            await page.waitForFunction(
                () => document.body.innerText.includes("I keep saying"),
                null,
                { timeout: 30000 }
            );
            await page.waitForFunction(
                () => Array.from(document.querySelectorAll('[role="button"]'))
                    .some((b) => (b.getAttribute('aria-label') || '').startsWith('Show thinking')),
                null,
                { timeout: 20000 }
            );

            if (SABOTAGE) {
                // (a) a microphone control that must trip the mic guard, and
                // (b) the composer bar pushed past the fold — the exact regression
                //     the clip guard exists for (a composer that does not ride above
                //     the keyboard). Injecting a spacer into #root does NOT move it
                //     (the app's column is fixed-height), so translate the composer
                //     bar itself, found as the ancestor holding BOTH the photo icon
                //     and the verbs.
                await page.evaluate(() => {
                    const fake = document.createElement('div');
                    fake.setAttribute('role', 'button');
                    fake.setAttribute('aria-label', 'Microphone');
                    fake.textContent = 'mic';
                    document.body.appendChild(fake);

                    const buttons = Array.from(document.querySelectorAll('[role="button"]'));
                    const photo = buttons.find((b) => b.getAttribute('aria-label') === 'Attach a photo');
                    const deeper = buttons.find((b) => (b.textContent || '').trim() === 'Go deeper');
                    let bar = deeper;
                    while (bar && photo && !bar.contains(photo)) bar = bar.parentElement;
                    if (bar) bar.style.transform = 'translateY(140px)';
                });
                await page.waitForTimeout(400);
            }

            // --- steady state: the work layer is collapsed ---
            const collapsed = await page.evaluate(PROBE);
            failures.push(...evaluate(`${label} collapsed`, collapsed, { scheme, state: 'collapsed' }));
            if (collapsed.toolRowLabels.length !== 0) {
                failures.push(`${label}: ${collapsed.toolRowLabels.length} tool rows visible while collapsed`);
            }

            // --- interact: expand the work layer ---
            await page.evaluate(() => {
                const b = Array.from(document.querySelectorAll('[role="button"]'))
                    .find((el) => (el.getAttribute('aria-label') || '').startsWith('Show thinking'));
                if (b) b.click();
            });
            await page.waitForTimeout(600);
            const expanded = await page.evaluate(PROBE);
            failures.push(...evaluate(`${label} expanded`, expanded, { scheme, state: 'expanded' }));
            if (expanded.toolRowLabels.length !== SEED_TOOLS.length) {
                failures.push(`${label}: expanded work layer shows ${expanded.toolRowLabels.length} tool rows, expected ${SEED_TOOLS.length}`);
            }
            if (!/Used 3 tools/.test(expanded.summaryText || '')) {
                failures.push(`${label}: summary line is ${JSON.stringify(expanded.summaryText)}`);
            }

            // --- capture the region that can see the change ---
            await page.evaluate(() => {
                const r = document.querySelector('[aria-label="Companion reasoning"]');
                if (r) r.scrollIntoView({ block: 'center' });
            });
            await page.waitForTimeout(500);
            const shot = path.join(OUT_DIR, `chat-surface-${size.name}-${scheme}-${STAMP}.png`);
            await page.screenshot({ path: shot });
            const hash = sha(shot);
            hashes.set(label, hash);
            results.push({
                label,
                size: `${size.width}x${size.height}`,
                scheme,
                hash,
                shot: path.basename(shot),
                viewport: `${collapsed.vw}x${collapsed.vh}`,
                composerBottom: collapsed.deeperRect ? `${collapsed.deeperRect.bottom} / vh ${collapsed.vh}` : 'n/a',
                docOverflowX: collapsed.docOverflowX,
                toolRows: expanded.toolRowLabels.length,
                summary: expanded.summaryText,
                reasoningColor: expanded.reasoningColor,
                railColor: collapsed.railColor,
                lefts: `writer ${collapsed.writerLeft} / rail ${collapsed.railLeft} / reply ${collapsed.replyLeft} / reasoning ${collapsed.reasoningLeft}`,
                icons: collapsed.iconButtonLabels.join(', '),
                pageErrors: consoleErrors.length,
            });

            // --- interact: collapse again ---
            await page.evaluate(() => {
                const b = Array.from(document.querySelectorAll('[role="button"]'))
                    .find((el) => (el.getAttribute('aria-label') || '').startsWith('Hide thinking'));
                if (b) b.click();
            });
            await page.waitForTimeout(500);
            const recollapsed = await page.evaluate(PROBE);
            if (recollapsed.toolRowLabels.length !== 0) {
                failures.push(`${label}: collapsing left ${recollapsed.toolRowLabels.length} tool rows visible`);
            }

            // --- interact: throw the header switch off. The work layer AND the
            // reasoning must be ABSENT — asserted without ever expanding them, so
            // "hidden behind a collapsed region" cannot pass for "removed". ---
            await page.evaluate(() => {
                const sw = document.querySelector('[role="switch"]');
                if (sw) sw.click();
            });
            await page.waitForTimeout(600);
            const off = await page.evaluate(PROBE);
            if (off.workLayerCount !== 0) {
                failures.push(`${label}: switch OFF left ${off.workLayerCount} work-layer node(s) in the tree`);
            }
            if (off.reasoningCount !== 0) {
                failures.push(`${label}: switch OFF left the reasoning rendered`);
            }
            if (off.toolRowLabels.length !== 0) {
                failures.push(`${label}: switch OFF left tool rows visible`);
            }
            if (document_hasUsedTools(off)) {
                failures.push(`${label}: switch OFF still shows the tool summary`);
            }
            const offShot = path.join(OUT_DIR, `chat-surface-${size.name}-${scheme}-thinking-off-${STAMP}.png`);
            await page.screenshot({ path: offShot });

            // --- interact: switch back on, then type into the slip ---
            await page.evaluate(() => {
                const sw = document.querySelector('[role="switch"]');
                if (sw) sw.click();
            });
            await page.waitForTimeout(500);
            await page.evaluate(() => {
                const el = document.querySelector('textarea');
                const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
                setter.call(el, 'the night is mine');
                el.dispatchEvent(new Event('input', { bubbles: true }));
            });
            await page.waitForTimeout(600);
            const typed = await page.evaluate(PROBE);
            if (typed.slipValue !== 'the night is mine') {
                failures.push(`${label}: typing did not reach the slip (value ${JSON.stringify(typed.slipValue)})`);
            }
            if (typed.deeperDisabled === 'true' || typed.deeperOpacity === '0.4') {
                failures.push(`${label}: "Go deeper" stayed disabled with text in the slip (aria-disabled=${typed.deeperDisabled}, opacity=${typed.deeperOpacity})`);
            }
            const backOn = await page.evaluate(PROBE);
            if (backOn.workLayerCount < 1) {
                failures.push(`${label}: switching thinking back on did not restore the work layer`);
            }

            if (consoleErrors.length > 0) {
                failures.push(`${label}: ${consoleErrors.length} uncaught page error(s): ${consoleErrors[0]}`);
            }

            if (SABOTAGE) {
                const fired = failures.filter((f) => f.startsWith(label));
                sabotageHits.push({ label, fired: fired.length, messages: fired });
                // Sabotage expectations are per-combination; clear so the summary is
                // only about whether the guards CAN fail.
                failures = failures.filter((f) => !f.startsWith(label));
            }

            await context.close();
        }
    }

    await browser.close();

    console.log('\n=== chat rendered-surface evidence ===');
    for (const r of results) {
        console.log(`\n[${r.label}] viewport ${r.viewport} · capture ${r.shot} sha=${r.hash}`);
        console.log(`  composer bottom: ${r.composerBottom} · doc horizontal overflow: ${r.docOverflowX}px`);
        console.log(`  work layer: ${r.toolRows} tool rows · "${r.summary}"`);
        console.log(`  left edges: ${r.lefts}`);
        console.log(`  reasoning colour ${r.reasoningColor} · rail ${r.railColor}`);
        console.log(`  composer icons: ${r.icons}`);
        console.log(`  page errors: ${r.pageErrors}`);
    }

    const distinct = new Set(hashes.values()).size;
    console.log(`\ncaptures: ${hashes.size} combinations, ${distinct} distinct hashes`);
    if (distinct !== hashes.size) {
        failures.push(`only ${distinct}/${hashes.size} captures differ — the combinations are not actually different (theme switch or size not applied)`);
    }

    if (SABOTAGE) {
        console.log('\n=== SABOTAGE run (guards must fire) ===');
        // Name each guard that must be able to fail. "2 guards fired" is not enough:
        // it can be the same guard twice and the other one still vacuous.
        const REQUIRED = [
            { name: 'clip guard', re: /is clipped/ },
            { name: 'mic guard', re: /microphone control still present/ },
        ];
        let allFired = true;
        for (const s of sabotageHits) {
            const hits = REQUIRED.filter((r) => s.messages.some((m) => r.re.test(m)));
            const missing = REQUIRED.filter((r) => !hits.includes(r)).map((r) => r.name);
            console.log(`  ${s.label}: ${s.messages.length} guard message(s); caught ${hits.map((h) => h.name).join(' + ') || 'none'}${missing.length ? ' — VACUOUS: ' + missing.join(', ') : ''}`);
            console.log(`    e.g. ${(s.messages[0] || '(nothing)')}`);
            if (missing.length) allFired = false;
        }
        if (!allFired) {
            console.log('\nSABOTAGE FAILED: a guard stayed green while its behaviour was broken.');
            process.exit(1);
        }
        console.log('\nSABOTAGE OK: injected mic + off-screen composer were caught by the guards.');
        process.exit(0);
    }

    if (failures.length > 0) {
        console.log(`\nFAIL (${failures.length}):`);
        for (const f of failures) console.log(`  - ${f}`);
        process.exit(1);
    }
    console.log('\nPASS: every combination rendered, measured and interacted cleanly.');
}

/** The switch-off check needs the same DOM fact the probe measures. */
function document_hasUsedTools(m) {
    return /Used \d+ tool/.test(m.summaryText || '') || /Thought it through/.test(m.summaryText || '');
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
