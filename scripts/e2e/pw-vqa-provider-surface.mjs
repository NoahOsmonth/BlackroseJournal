/**
 * Provider-surface visual QA (the UI the provider-agnostic rewrite replaced:
 * Settings → AI Model, and the model picker sheet).
 *
 * Renders at desktop and mobile widths in BOTH colour schemes and measures
 * instead of eyeballing. Run with Expo web serving :8081:
 *
 *   npx expo start --web --port 8081        # terminal 1 (watch mode, not CI)
 *   node scripts/e2e/pw-vqa-provider-surface.mjs
 *
 * Env: E2E_BASE_URL, E2E_HEADLESS=0 to watch.
 *
 * Two traps this harness exists to avoid, both hit for real:
 *  1. Playwright's `colorScheme` context option does NOT move NativeWind's web
 *     hook — the app's own Appearance control does. Light/dark screenshots
 *     produced via `colorScheme` were byte-identical, i.e. silently invalid.
 *  2. Screenshots lie about layout. Every claim here comes from
 *     getBoundingClientRect / getComputedStyle. Two "defects" a vision pass
 *     reported from pixels — a chip clipped at the viewport edge and a
 *     near-invisible model value — were both false; the DOM showed the chip
 *     inside its parent with a visible border and the text at 17.21:1.
 *
 * Browser storage only; no app code is modified.
 */
import { chromium } from 'playwright';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:8081';
const HEADLESS = process.env.E2E_HEADLESS !== '0';
const OUT = path.join(process.cwd(), 'output', 'vqa');
const ACCOUNT_ID = 'e2e-local-account';
const SETTINGS_KEY = `@blackrose_account:v1:${encodeURIComponent(ACCOUNT_ID)}:blackrose_custom_ai_provider`;

const MODELS = ['anthropic/claude-sonnet-4.5', 'openai/gpt-5.1', 'google/gemini-3-pro',
    'deepseek/deepseek-v4.1-flash', 'qwen/qwen3-max']
    .map((id) => ({ id, contextWindow: 128000, contextWindowSource: 'api' }));

/** Two profiles, the second with a label long enough to overflow a phone row. */
const SETTINGS = {
    schemaVersion: 2, enabled: true, activeProfileId: 'p1', updatedAt: 1_700_000_000_000,
    profiles: [
        { id: 'p1', label: 'Home gateway', baseUrl: 'https://api.example.com/v1', apiKey: 'sk-vqa',
          selectedModelId: 'anthropic/claude-sonnet-4.5', flashModelId: 'deepseek/deepseek-v4.1-flash',
          models: MODELS, recentModelIds: ['openai/gpt-5.1'],
          modelFilterPatterns: ['claude', 'gpt', 'gemini'], fallbackModelIds: ['openai/gpt-5.1'],
          contextWindowOverride: null, fallbackContextWindow: 128000,
          createdAt: 1_700_000_000_000, updatedAt: 1_700_000_000_000 },
        { id: 'p2', label: 'Work account with a deliberately long provider name',
          baseUrl: 'https://gateway.internal.example.net/v1', apiKey: 'sk-vqa-2',
          selectedModelId: 'qwen/qwen3-max', flashModelId: null, models: [], recentModelIds: [],
          modelFilterPatterns: [], fallbackModelIds: [], contextWindowOverride: null,
          fallbackContextWindow: 128000, createdAt: 1_700_000_000_000, updatedAt: 1_700_000_000_000 },
    ],
};

const PROBE = `(() => {
  const parse = (c) => { const m = String(c).match(/rgba?\\(([^)]+)\\)/); if (!m) return null;
    const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = (el) => { let n = el;
    while (n && n !== document.documentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0.5) return c; n = n.parentElement; }
    const c = parse(getComputedStyle(document.body).backgroundColor); return c && c.a > 0.5 ? c : { r: 255, g: 255, b: 255, a: 1 }; };
  const ratioOf = (el) => { const fg = parse(getComputedStyle(el).color); const bg = bgOf(el); if (!fg) return null;
    const l1 = lum(fg), l2 = lum(bg);
    return { ratio: Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 100) / 100,
      fg: getComputedStyle(el).color, bg: 'rgb(' + bg.r + ',' + bg.g + ',' + bg.b + ')' }; };
  const leaf = (re) => [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && re.test(e.textContent.trim()));
  const rect = (el) => { const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) }; };
  const vw = document.documentElement.clientWidth;

  const out = { vw, docScrollWidth: document.documentElement.scrollWidth,
    themePill: (() => { const e = leaf(/^(Light|Dark|System) · /); return e ? e.textContent.trim() : null; })() };

  // The Base URL must be reachable in the MAIN form with Advanced collapsed —
  // it is the one field you cannot add a provider without, and it once lived
  // behind the "Advanced" toggle, so "Add provider" offered a key and no
  // endpoint. This probe runs before Advanced is expanded.
  out.mainInputs = [...document.querySelectorAll('input, textarea')]
    .map((el) => el.getAttribute('aria-label') || '(unlabelled)');

  const rowText = document.querySelector('[data-testid="settings-row-text-customAi"]');
  if (rowText) {
    out.rowText = rect(rowText);
    out.rowLines = [...rowText.querySelectorAll('*')]
      .filter((e) => e.children.length === 0 && e.textContent.trim())
      .map((e) => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
        const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
        return { text: e.textContent.trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height),
          lines: Math.round(r.height / lh), truncated: e.scrollWidth > e.clientWidth + 1 }; });
  }

  // Chips: the chrome (and so the border) lives on the inner View; the pressable
  // is a bare wrapper. Measure the chip View, and check it against both the row
  // container and the viewport.
  out.chips = [...document.querySelectorAll('[data-testid^="provider-chip-"]')].map((c) => {
    const press = c.closest('[role="button"]') || c.parentElement;
    const row = press.parentElement;
    const cr = c.getBoundingClientRect(); const pr = press.getBoundingClientRect();
    const rr = row.getBoundingClientRect();
    const cs = getComputedStyle(c);
    const textEl = c.querySelector('*');
    const tcs = textEl ? getComputedStyle(textEl) : null;
    return { text: c.textContent.trim().slice(0, 60), ...rect(c),
      pressW: Math.round(pr.width), rowW: Math.round(rr.width), rowRight: Math.round(rr.right),
      insideViewport: cr.right <= vw + 0.5, insideRow: cr.right <= rr.right + 0.5,
      borderRight: cs.borderRightWidth + ' ' + cs.borderRightStyle + ' ' + cs.borderRightColor,
      // A long provider label is expected to ellipsise inside the chip, not to
      // wrap or push the chip past its row. Record it, so "text looks cut off"
      // is a measured fact with a known cause rather than a screenshot read.
      chipScrollW: c.scrollWidth, chipClientW: c.clientWidth,
      chipClipsContent: c.scrollWidth > c.clientWidth + 1,
      textOverflow: tcs ? tcs.textOverflow : null,
      textLines: textEl ? textEl.getClientRects().length : null };
  });

  // Contrast sweep, restricted to the expanded AI Model band.
  const band = document.querySelector('[data-testid="settings-band-customAi"]');
  const sweep = [];
  if (band) for (const el of band.querySelectorAll('*')) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.05) continue;
    const c = ratioOf(el); if (!c) continue;
    sweep.push({ text: el.textContent.trim().slice(0, 34), ratio: c.ratio, fg: c.fg, bg: c.bg });
  }
  out.sweepSize = sweep.length;
  out.belowAA = sweep.filter((s) => s.ratio < 4.5);
  return out;
})()`;

const PICKER_PROBE = `(() => {
  const t = document.body.innerText;
  const vw = document.documentElement.clientWidth;
  const bad = [];
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const ox = getComputedStyle(el).overflowX;
    if (r.right > vw + 1 && ox !== 'hidden' && ox !== 'scroll' && ox !== 'auto') {
      bad.push({ tag: el.tagName.toLowerCase(), text: (el.textContent || '').trim().slice(0, 30), right: Math.round(r.right) });
    }
  }
  return { dialogs: document.querySelectorAll('[role="dialog"]').length,
    hasRecent: /RECENT/i.test(t), hasAllModels: /ALL MODELS/i.test(t),
    overflow: bad.slice(0, 6) };
})()`;

const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 12);

/**
 * The Advanced block is where this change rewrote copy (model-filter and
 * manual-model placeholders, plus a help line). Measure the rendered strings —
 * placeholders live on the attribute, so read `placeholder` and the
 * `::placeholder` pseudo-element colour, not the element's own colour.
 */
const ADVANCED_PROBE = `(() => {
  const parse = (c) => { const m = String(c).match(/rgba?\\(([^)]+)\\)/); if (!m) return null;
    const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (fg, bg) => { const l1 = lum(fg), l2 = lum(bg);
    return Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 100) / 100; };
  const rect = (el) => { const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) }; };
  const vw = document.documentElement.clientWidth;

  const inputs = [...document.querySelectorAll('input, textarea')].map((el) => {
    const ph = getComputedStyle(el, '::placeholder');
    const bg = parse(getComputedStyle(el).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
    const phc = parse(ph.color);
    return { label: el.getAttribute('aria-label') || '', placeholder: el.placeholder || '',
      ...rect(el), overflows: el.getBoundingClientRect().right > vw + 1,
      editable: !el.disabled && !el.readOnly,
      placeholderContrast: phc ? ratio(phc, bg) : null,
      textContrast: (() => { const fg = parse(getComputedStyle(el).color); return fg ? ratio(fg, bg) : null; })() };
  });

  const helpTexts = [...document.querySelectorAll('*')]
    .filter((e) => e.children.length === 0 && /Type a model id|Comma-separated substrings|Fallback context/i.test(e.textContent.trim()))
    .map((e) => { const bg = (() => { let n = e; while (n && n !== document.documentElement) {
        const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0.5) return c; n = n.parentElement; }
        return { r: 255, g: 255, b: 255, a: 1 }; })();
      const fg = parse(getComputedStyle(e).color);
      return { text: e.textContent.trim().slice(0, 70), ...rect(e),
        overflows: e.getBoundingClientRect().right > vw + 1,
        contrast: fg ? ratio(fg, bg) : null }; });

  const body = document.body.innerText;
  // Placeholders do NOT appear in innerText, so a copy check that reads only
  // body text cannot see the very strings this change rewrote — and would have
  // silently passed on the vendor placeholders it exists to catch. Fold the
  // placeholder attributes into the corpus.
  const corpus = [body, ...inputs.map((i) => i.placeholder)].join('\\n');
  return { vw, docScrollWidth: document.documentElement.scrollWidth, inputs, helpTexts,
    corpusHasNeutralFilter: corpus.includes('gpt-4o, claude-'),
    corpusHasNeutralManual: corpus.includes('gpt-4o-mini'),
    // Vendor vocabulary must not reach the rendered surface.
    vendorInDom: ['qwen-web', 'qwen3.8-max', ':free,'].filter((t) => corpus.includes(t)) };
})()`;

async function ensureAdvancedOpen(page, label = '') {
    // Signal on the same DOM fact the probe measures. Playwright's getByLabel
    // and a querySelectorAll of the live DOM disagreed here, so the locator
    // cannot be trusted as the "is it open" signal.
    //
    // The signal must be a field that exists ONLY inside Advanced. It used to be
    // "Provider name" — until that moved into the main form, at which point the
    // signal became permanently true and every "is it open" answer a false
    // positive. "Model filter patterns" is Advanced-only today; re-check it if it
    // ever moves too.
    const openCount = () => page.evaluate(
        () => document.querySelectorAll('input[aria-label="Model filter patterns"]').length);
    if ((await openCount()) > 0) {
        console.log(`    [${label}] Advanced already open`);
        return true;
    }
    const toggle = page.getByLabel('Advanced AI provider settings').first();
    if ((await toggle.count()) === 0) {
        console.log(`    [${label}] Advanced toggle NOT FOUND`);
        return false;
    }
    let clickErr = null;
    await toggle.click({ timeout: 8000 }).catch((e) => { clickErr = String(e).slice(0, 90); });
    if (clickErr) console.log(`    [${label}] Advanced click error: ${clickErr}`);
    // Poll rather than a single fixed wait: the accordion body mounts after the
    // press handler runs.
    for (let i = 0; i < 8; i += 1) {
        await page.waitForTimeout(500);
        if ((await openCount()) > 0) {
            console.log(`    [${label}] Advanced opened after ~${(i + 1) * 500}ms`);
            return true;
        }
    }
    const seen = await page.evaluate(() => [...document.querySelectorAll('[aria-label]')]
        .map((e) => e.getAttribute('aria-label')).filter((l) => /provider/i.test(l)).slice(0, 12));
    console.log(`    [${label}] Advanced still closed; provider aria-labels seen: ${JSON.stringify(seen)}`);
    return false;
}

async function ensureExpanded(page, headerText, bodyText) {
    const body = page.getByText(bodyText, { exact: false }).first();
    if (await body.isVisible({ timeout: 800 }).catch(() => false)) return;
    await page.getByText(headerText, { exact: true }).first().click().catch(() => {});
    await page.waitForTimeout(1600);
}

async function run() {
    fs.mkdirSync(OUT, { recursive: true });
    const browser = await chromium.launch({ headless: HEADLESS });
    const rows = [];
    const failures = [];

    for (const vp of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
        const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
        await context.addInitScript(({ accountId, key, settings }) => {
            for (let i = localStorage.length - 1; i >= 0; i -= 1) {
                const k = localStorage.key(i);
                if (k && /^@blackrose|^@rosebud/.test(k)) localStorage.removeItem(k);
            }
            localStorage.setItem('@blackrose_account_registry', JSON.stringify({
                schemaVersion: 1, rememberedAccountId: accountId,
                accounts: { [accountId]: { id: accountId, email: null, lastAuthenticatedAt: Date.now() } } }));
            localStorage.setItem(key, JSON.stringify(settings));
            localStorage.setItem(`@blackrose_account:v1:${encodeURIComponent(accountId)}:demo_data_seeded`, 'true');
        }, { accountId: ACCOUNT_ID, key: SETTINGS_KEY, settings: SETTINGS });

        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e?.message || e).slice(0, 160)));

        await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(4500);
        const own = page.getByLabel(/Yes, this data is mine/i);
        if (await own.isVisible({ timeout: 1500 }).catch(() => false)) { await own.click(); await page.waitForTimeout(1500); }

        for (const scheme of ['Light', 'Dark']) {
            // Theme must go through the app's own control; `colorScheme` emulation
            // leaves NativeWind's web hook on the previous value. Use the control
            // itself as the "is the Appearance body rendered" signal — the row's
            // hint is visible while collapsed, so it is not one.
            let ctl = page.getByLabel(`Select ${scheme} theme`).first();
            if ((await ctl.count()) === 0) {
                await page.getByText('Appearance', { exact: true }).first().click().catch(() => {});
                await page.waitForTimeout(1600);
                ctl = page.getByLabel(`Select ${scheme} theme`).first();
            }
            if ((await ctl.count()) === 0) {
                failures.push(`${vp.name}/${scheme}: theme control not found`);
                continue;
            }
            await ctl.click().catch(() => {});
            await page.waitForTimeout(1600);
            await ensureExpanded(page, 'AI Model', 'Use a custom AI provider');
            await page.getByText('Saved providers', { exact: false }).first().scrollIntoViewIfNeeded().catch(() => {});
            await page.waitForTimeout(900);

            // Collapse Advanced before measuring the main form. The Dark pass
            // reuses the page the Light pass left with Advanced expanded, and the
            // Base URL assertion must mean "visible WITHOUT expanding".
            if (await page.evaluate(
                () => document.querySelectorAll('input[aria-label="Model filter patterns"]').length) > 0) {
                await page.getByLabel('Advanced AI provider settings').first().click().catch(() => {});
                for (let i = 0; i < 8; i += 1) {
                    await page.waitForTimeout(400);
                    const stillOpen = await page.evaluate(
                        () => document.querySelectorAll('input[aria-label="Model filter patterns"]').length);
                    if (stillOpen === 0) break;
                }
            }

            const label = `${vp.name}/${scheme.toLowerCase()}`;
            const shot = path.join(OUT, `provider-surface-${vp.name}-${scheme.toLowerCase()}.png`);
            await page.screenshot({ path: shot });
            const r = await page.evaluate(PROBE);

            // The screenshot above is anchored near the section top and never
            // reaches the API key / Base URL fields, so its hash is blind to this
            // fix. Capture them explicitly, or the only evidence for the Base URL
            // move would be a DOM read.
            await page.evaluate(() => {
                const el = document.querySelector('input[aria-label="Custom AI base URL"]');
                if (el) el.scrollIntoView({ block: 'center' });
            });
            await page.waitForTimeout(700);
            const formShot = path.join(OUT, `provider-form-${vp.name}-${scheme.toLowerCase()}.png`);
            await page.screenshot({ path: formShot });
            console.log(`  form shot: ${path.basename(formShot)} sha=${sha(formShot)}`);

            // Interaction, not just presence: the field must actually bind. The
            // "Active model" host label is derived from draft.baseUrl, so typing a
            // host must surface it live — proof the input is wired to state and
            // not merely rendered. Cleared afterwards so later steps see the seed.
            const typedHost = 'typed.example.test';
            let hostEchoed = null;
            try {
                const baseInput = page.getByLabel('Custom AI base URL').first();
                await baseInput.fill(`https://${typedHost}/v1`);
                await page.waitForTimeout(500);
                hostEchoed = await page.evaluate((h) => {
                    const el = [...document.querySelectorAll('*')].find(
                        (e) => e.children.length === 0 && e.textContent.includes(h));
                    return el ? el.textContent.trim() : null;
                }, typedHost);
                await baseInput.fill('');
                await page.waitForTimeout(300);
            } catch (e) {
                hostEchoed = `error: ${String(e).slice(0, 70)}`;
            }
            console.log(`  typed a Base URL -> Active model host label: ${JSON.stringify(hostEchoed)}`);
            if (!hostEchoed || !String(hostEchoed).includes(typedHost)) {
                failures.push(`${label}: typing a Base URL did not reach the Active model host label -> ${JSON.stringify(hostEchoed)}`);
            }

            const stacked = (r.rowLines || []).filter((l) => l.lines > 1);
            const escaping = (r.chips || []).filter((c) => !c.insideViewport || !c.insideRow);
            const noBorder = (r.chips || []).filter((c) => /0px/.test(c.borderRight));
            const lowContrast = r.belowAA || [];

            console.log(`\n=== ${label} === vw=${r.vw} docScrollWidth=${r.docScrollWidth} theme=${r.themePill} sha=${sha(shot)}`);
            console.log(`  main-form inputs (Advanced collapsed): ${JSON.stringify(r.mainInputs)}`);
            for (const l of r.rowLines || []) {
                console.log(`  row line: "${l.text}" lines=${l.lines} w=${l.w} truncated=${l.truncated}`);
            }
            for (const c of r.chips || []) {
                console.log(`  chip: "${c.text}" w=${c.w} right=${c.right} parentRight=${c.rowRight} inside=${c.insideViewport && c.insideRow} border=${c.borderRight}`);
            }
            console.log(`  contrast sweep: ${r.sweepSize} nodes, below AA(4.5): ${lowContrast.length}`);
            console.log(`  page errors: ${errors.length}`);

            if (r.docScrollWidth > r.vw) failures.push(`${label}: document scrolls horizontally (${r.docScrollWidth} > ${r.vw})`);
            // A probe that matches nothing must fail, not pass vacuously — this
            // check silently no-opped once when the assignment was dropped.
            if (!r.chips || r.chips.length === 0) failures.push(`${label}: chip probe matched 0 elements (selector or seed broke)`);
            // The fields you cannot add a provider without must be in the main
            // form, not behind "Advanced": the base URL (no endpoint) and the
            // provider name (or a new provider keeps its generated "Provider 2").
            for (const required of ['Custom AI base URL', 'Provider name']) {
                if (!(r.mainInputs || []).includes(required)) {
                    failures.push(`${label}: "${required}" not in the main form -> ${JSON.stringify(r.mainInputs)}`);
                }
            }
            for (const c of (r.chips || [])) {
                console.log(`    chip "${c.text}" w=${c.w} right=${c.right} lines=${c.textLines} `
                    + `clips=${c.chipClipsContent} textOverflow=${c.textOverflow} inRow=${c.insideRow}`);
            }
            // A long provider label must ellipsise inside the chip, never wrap to
            // a second line — that is the bug class this whole surface is about.
            const multiLineChips = (r.chips || []).filter((c) => c.textLines > 1);
            if (multiLineChips.length) failures.push(`${label}: chip label wrapped to >1 line -> ${JSON.stringify(multiLineChips.map((c) => c.text))}`);
            if ((r.rowLines || []).length === 0) failures.push(`${label}: row-text probe matched 0 elements`);
            if (stacked.length) failures.push(`${label}: row text wraps past one line -> ${JSON.stringify(stacked)}`);
            if (escaping.length) failures.push(`${label}: chip escapes its row -> ${JSON.stringify(escaping.map((c) => c.text))}`);
            if (noBorder.length) failures.push(`${label}: chip lost its right border -> ${JSON.stringify(noBorder.map((c) => c.text))}`);
            if (lowContrast.length) failures.push(`${label}: text below 4.5:1 -> ${JSON.stringify(lowContrast.slice(0, 4))}`);
            if (errors.length) failures.push(`${label}: ${errors.length} page error(s) -> ${errors.slice(0, 2).join(' | ')}`);

            // --- Advanced block: the copy this change rewrote ---
            if (!(await ensureAdvancedOpen(page, label))) {
                failures.push(`${label}: Advanced block could not be expanded`);
            } else {
                await page.getByText('Model filters', { exact: true }).first()
                    .scrollIntoViewIfNeeded().catch(() => {});
                await page.waitForTimeout(800);
                const advShot = path.join(OUT, `provider-advanced-${vp.name}-${scheme.toLowerCase()}.png`);
                await page.screenshot({ path: advShot });
                const a = await page.evaluate(ADVANCED_PROBE);
                console.log(`  advanced: sha=${sha(advShot)} inputs=${a.inputs.length} help=${a.helpTexts.length}`);
                for (const i of a.inputs) {
                    console.log(`    input "${i.label}" ph="${i.placeholder}" w=${i.w} overflows=${i.overflows}`
                        + ` editable=${i.editable} phContrast=${i.placeholderContrast}`);
                }
                for (const h of a.helpTexts) {
                    console.log(`    help "${h.text}" w=${h.w} overflows=${h.overflows} contrast=${h.contrast}`);
                }
                console.log(`    vendor copy rendered: ${a.vendorInDom.length ? JSON.stringify(a.vendorInDom) : 'none'}`);

                if (a.docScrollWidth > a.vw) failures.push(`${label}: Advanced block scrolls horizontally`);
                if (!a.inputs.length) failures.push(`${label}: Advanced probe matched 0 inputs`);
                if (a.vendorInDom.length) failures.push(`${label}: vendor copy still rendered -> ${JSON.stringify(a.vendorInDom)}`);
                if (!a.corpusHasNeutralFilter) failures.push(`${label}: neutral model-filter placeholder missing`);
                if (!a.corpusHasNeutralManual) failures.push(`${label}: neutral manual-model copy missing`);
                const badInputs = a.inputs.filter((i) => i.overflows || !i.editable);
                if (badInputs.length) {
                    failures.push(`${label}: input overflows / not editable -> ${JSON.stringify(badInputs.map((i) => i.label))}`);
                }
                const badHelp = a.helpTexts.filter((h) => h.overflows);
                if (badHelp.length) failures.push(`${label}: help text overflows -> ${JSON.stringify(badHelp.map((h) => h.text))}`);
            }

            rows.push({ label, theme: r.themePill, sha: sha(shot), chips: r.chips?.length ?? 0, sweep: r.sweepSize });
        }

        // Model picker sheet — the other half of this surface.
        const trigger = page.getByLabel('Change active model').first();
        if ((await trigger.count()) > 0) {
            await trigger.click().catch(() => {});
            await page.waitForTimeout(2500);
            const p = await page.evaluate(PICKER_PROBE);
            const shot = path.join(OUT, `provider-picker-${vp.name}.png`);
            await page.screenshot({ path: shot });
            console.log(`  picker: dialogs=${p.dialogs} recent=${p.hasRecent} allModels=${p.hasAllModels} overflow=${p.overflow.length} sha=${sha(shot)}`);
            if (p.overflow.length) failures.push(`${vp.name} picker: overflow -> ${JSON.stringify(p.overflow)}`);
        }
    }

    await browser.close();
    console.log('\n===== VERDICT =====');
    for (const r of rows) console.log(`  ${r.label}: theme=${r.theme} chips=${r.chips} sweep=${r.sweep} sha=${r.sha}`);
    if (failures.length) {
        console.log(`FAIL (${failures.length}):`);
        for (const f of failures) console.log('  - ' + f);
        process.exit(1);
    }
    console.log('RESULT: PASS — no overflow, no wrapped row text, no missing borders, no sub-AA text, no page errors');
}

run().catch((e) => { console.error('ERROR', e?.stack || e); process.exit(1); });
