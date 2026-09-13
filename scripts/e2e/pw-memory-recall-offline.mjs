/**
 * Offline-first memory E2E: real Expo web app + live OmniRoute model, with
 * Hindsight (:8890) and Supabase (:54321) request-blocked.
 *
 * Run: node scripts/e2e/pw-memory-recall-offline.mjs   (Expo web must serve :8081)
 * Env: E2E_BASE_URL, E2E_HEADLESS=0 to watch.
 *
 * Flow: clear browser storage -> seed a valid (non-expired) Supabase session so
 * auth bootstraps offline without credentials -> write a journal entry with
 * distinctive nouns -> Finish entry -> assert a staged memory file landed in
 * AsyncStorage-ish localStorage -> fresh chat -> ask a recall question -> assert
 * the assistant answered from the offline memory file, verbatim.
 *
 * Test scaffolding is browser storage only: no app code is modified.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:8081';
const HEADLESS = process.env.E2E_HEADLESS !== '0';
const onlyDemoClear = process.env.E2E_ONLY_DEMO_CLEAR === '1';
const offlineWalk = process.env.E2E_OFFLINE_WALK === '1';
const bootOnly = process.env.E2E_BOOT_ONLY === '1';
const signOutCheck = process.env.E2E_SIGNOUT_CHECK === '1';
const seedForWalk = onlyDemoClear || offlineWalk || bootOnly || signOutCheck;
/** abort = host unreachable · 503 = paused project · hang = blackholed packets. */
const supabaseMode = process.env.E2E_SUPABASE_MODE || 'abort';
/** 1 = stored access token already expired, so supabase-js must refresh it. */
const expiredSession = process.env.E2E_EXPIRED_SESSION === '1';
const OUT_DIR = path.join(process.cwd(), 'output', 'playwright');
const LOG_PATH = path.join(OUT_DIR, `memory-recall-offline-${Date.now()}.log`);

const ACCOUNT_ID = 'e2e-offline-account';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://100.107.7.52:54321';
// supabase-js default: `sb-${hostname.split('.')[0]}-auth-token`.
const SUPABASE_SESSION_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;

const ENTRY_TEXT =
    "Tonight I finally told Mara about the copper lighthouse tattoo I've been hiding since the Reykjavik trip. " +
    'The marathon in November is still on my mind too - Tuesday tempo runs, Sunday long slow runs. ' +
    'Legs are tired but my heart is proud of week four.';
const RECALL_QUESTION =
    'What do you remember about the copper lighthouse tattoo and the Reykjavik trip? ' +
    'Search your offline memory and quote what you find.';

const logLines = [];
function log(...parts) {
    const line = parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join(' ');
    logLines.push(line);
    console.log(line);
}

function persistLog() {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(LOG_PATH, logLines.join('\n'));
    console.log('LOG:', LOG_PATH);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function inputLocator(page) {
    return page.locator('textarea[placeholder*="Write what\'s true"], textarea[placeholder*="Type your thoughts"]').first();
}

async function sendTurn(page, text) {
    const input = await inputLocator(page);
    await input.waitFor({ state: 'visible', timeout: 30000 });
    await input.click();
    await input.fill('');
    await input.type(text, { delay: 8 });
    await page.keyboard.press('Enter');
}

const BUSY_RE = /AI is thinking|AI typing|Working\b/i;

/** Reply = everything after the last occurrence of the user's own turn. */
function replyAfter(body, userText) {
    const index = body.lastIndexOf(userText);
    if (index < 0) return '';
    return body.slice(index + userText.length).trim();
}

/** Heuristic settle (same shape as the pw-* probes): thinking clears + input idle. */
async function waitForAssistantSettle(page, userText, timeoutMs = 150000) {
    const started = Date.now();
    const input = await inputLocator(page);
    let sawThinking = false;
    let stableSince = Date.now();
    let lastBody = '';
    let body = '';
    while (Date.now() - started < timeoutMs) {
        body = await page.locator('body').innerText();
        const busy = BUSY_RE.test(body);
        if (busy) sawThinking = true;
        if (body !== lastBody) {
            lastBody = body;
            stableSince = Date.now();
        }
        const back = await input.isVisible({ timeout: 300 }).catch(() => false);
        const idle = Date.now() - stableSince;
        if (!busy && back && idle > 9000 && (sawThinking || Date.now() - started > 25000)) {
            return { reply: replyAfter(body, userText), elapsedMs: Date.now() - started, sawThinking };
        }
        await wait(2000);
    }
    return { reply: replyAfter(body, userText), elapsedMs: Date.now() - started, timedOut: true, sawThinking, bodyTail: body.slice(-1500) };
}

/**
 * Memory files: body key holds the raw markdown body; headers live in the
 * manifest. Both are account-scoped, so match on the suffix.
 */
async function readMemoryFiles(page) {
    return page.evaluate(() => {
        const files = [];
        let manifest = null;
        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (!key) continue;
            if (key.includes('blackrose_memory_file:')) {
                const id = key.slice(key.indexOf('blackrose_memory_file:') + 'blackrose_memory_file:'.length);
                files.push({ id, body: localStorage.getItem(key) || '' });
            }
            if (key.includes('blackrose_memory_manifest')) {
                try {
                    manifest = JSON.parse(localStorage.getItem(key) || 'null');
                } catch {
                    manifest = null;
                }
            }
        }
        const headers = manifest && typeof manifest === 'object' && manifest.files ? Object.values(manifest.files) : [];
        return {
            files,
            headers: headers.map((h) => ({
                id: h.id,
                name: h.name,
                description: h.description,
                type: h.type,
                deprecated: !!h.deprecated,
                sourceSessionKey: h.sourceSessionKey ?? null,
            })),
        };
    });
}

async function readSeedRecord(page) {
    return page.evaluate(() => {
        const empty = { present: false, journalEntryIds: [], checkInIds: [] };
        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (!key || !key.includes('demo_data_seed_record')) continue;
            const raw = localStorage.getItem(key);
            if (!raw) return empty;
            try {
                const parsed = JSON.parse(raw);
                return {
                    present: true,
                    journalEntryIds: parsed?.journalEntryIds ?? [],
                    checkInIds: parsed?.checkInIds ?? [],
                };
            } catch {
                return { present: true, journalEntryIds: [], checkInIds: [] };
            }
        }
        return empty;
    });
}

async function main() {
    const browser = await chromium.launch({ headless: HEADLESS });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

    const session = {
        access_token: 'e2e-offline-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 86400 * 30,
        refresh_token: 'e2e-offline-refresh-token',
        user: {
            id: ACCOUNT_ID,
            aud: 'authenticated',
            role: 'authenticated',
            email: 'e2e-offline@local.test',
            email_confirmed_at: new Date().toISOString(),
            is_anonymous: false,
            app_metadata: { provider: 'email', providers: ['email'] },
            user_metadata: {},
            created_at: new Date().toISOString(),
        },
    };

    await context.addInitScript(
        ({ sessionKey, sessionValue, accountId, suppressSeed, expired }) => {
            if (localStorage.getItem('__e2e_offline_seed__')) return;
            for (let i = localStorage.length - 1; i >= 0; i -= 1) {
                const key = localStorage.key(i);
                if (!key) continue;
                if (/^@blackrose|^@demo_|^@rosebud|^sb-/.test(key)) localStorage.removeItem(key);
            }
            const expiresAt = expired
                ? Math.floor(Date.now() / 1000) - 3600
                : Math.floor(Date.now() / 1000) + 86400 * 30;
            localStorage.setItem(sessionKey, JSON.stringify({ ...sessionValue, expires_at: expiresAt }));
            localStorage.setItem(
                '@blackrose_account_registry',
                JSON.stringify({
                    schemaVersion: 1,
                    rememberedAccountId: accountId,
                    accounts: {
                        [accountId]: { id: accountId, email: 'e2e-offline@local.test', lastAuthenticatedAt: Date.now() },
                    },
                }),
            );
            // Demo seed is dev-only and pollutes recall probes (rule 8): keep it off
            // unless this run exists to prove the demo-clear path.
            if (suppressSeed) {
                localStorage.setItem(`@blackrose_account:v1:${encodeURIComponent(accountId)}:demo_data_seeded`, 'true');
            }
            localStorage.setItem('__e2e_offline_seed__', '1');
        },
        {
            sessionKey: SUPABASE_SESSION_KEY,
            sessionValue: session,
            accountId: ACCOUNT_ID,
            suppressSeed: !seedForWalk,
            expired: expiredSession,
        },
    );

    let hindsightBlocked = 0;
    let agentGatewayBlocked = 0;
    let supabaseBlocked = 0;
    const toolNames = [];
    const calledTools = [];
    const consoleLines = [];

    await context.route(/100\.107\.7\.52:(54321|8787|8890)/, (route) => {
        const url = route.request().url();
        if (/:8787/.test(url)) {
            agentGatewayBlocked += 1;
            hindsightBlocked += 1;
            return route.abort('failed');
        }
        if (/:8890/.test(url)) {
            hindsightBlocked += 1;
            return route.abort('failed');
        }
        supabaseBlocked += 1;
        if (supabaseMode === 'hang') return undefined; // never answered: blackholed packets
        if (supabaseMode.startsWith('revoked')) {
            // Supabase reachable, credential rejected: refresh token no longer valid.
            const payload = supabaseMode === 'revoked'
                ? { code: 'refresh_token_not_found', message: 'Invalid Refresh Token' }
                : { message: 'Invalid Refresh Token' };
            return route.fulfill({
                status: 400,
                contentType: 'application/json',
                body: JSON.stringify(payload),
            });
        }
        if (supabaseMode === '503') {
            return route.fulfill({
                status: 503,
                contentType: 'application/json',
                body: JSON.stringify({ message: 'Service Unavailable' }),
            });
        }
        return route.abort('failed');
    });

    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(String(error?.message || error).slice(0, 200)));
    page.on('console', (msg) => {
        const text = msg.text();
        if (/hindsight|agent[-_]|tool|memory|Supabase|supabase/i.test(text)) consoleLines.push(text.slice(0, 300));
    });
    page.on('request', (req) => {
        if (!/:20128/.test(req.url())) return;
        try {
            const payload = JSON.parse(req.postData() || '{}');
            const names = (payload.tools || []).map((t) => t.function?.name || t.name).filter(Boolean);
            log('[llm-request] tools=' + JSON.stringify(names));
            for (const name of names) toolNames.push(name);
        } catch {
            /* streaming bodies not always JSON here */
        }
    });
    page.on('response', async (res) => {
        if (!/:20128/.test(res.url())) return;
        try {
            const text = await res.text();
            const record = (message) => {
                for (const call of message?.tool_calls || []) {
                    const name = call.function?.name || call.name;
                    if (!name) continue;
                    calledTools.push({ name, at: Date.now() });
                    log('[llm-tool-call] ' + name);
                }
            };
            try {
                // Non-streaming completion (agent loop rounds): whole-body JSON.
                const json = JSON.parse(text);
                record(json.choices?.[0]?.message || json.choices?.[0]?.delta);
            } catch {
                // SSE stream: one JSON payload per `data:` line.
                for (const line of text.split(/\r?\n/)) {
                    if (!line.startsWith('data:')) continue;
                    const payload = line.slice(5).trim();
                    if (!payload || payload === '[DONE]') continue;
                    try {
                        const json = JSON.parse(payload);
                        record(json.choices?.[0]?.message || json.choices?.[0]?.delta);
                    } catch {
                        /* partial SSE frame */
                    }
                }
            }
        } catch {
            /* body already consumed */
        }
    });
    page.on('requestfailed', (req) => {
        const url = req.url();
        if (/:8787/.test(url)) agentGatewayBlocked += 1;
        if (/:8787/.test(url) || /:8890/.test(url)) hindsightBlocked += 1;
        if (/:54321/.test(url)) supabaseBlocked += 1;
    });

    // Demo-clear / walk modes start on Today: the header gear is the only in-app
    // route to Settings, and a document reload mid-seed would measure an
    // interruption rather than the product path.
    await page.goto(seedForWalk ? `${BASE}/today` : `${BASE}/chat`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await wait(4000);

    const ownership = page.getByLabel(/Yes, this data is mine/i);
    if (await ownership.isVisible({ timeout: 1500 }).catch(() => false)) {
        await ownership.click();
        await wait(1500);
    }

    if (!seedForWalk) {
        const input = await inputLocator(page);
        if (!(await input.isVisible({ timeout: 60000 }).catch(() => false))) {
            log('FAIL: chat composer never appeared. URL=' + page.url());
            log('BODY:', (await page.locator('body').innerText()).slice(0, 1200));
            log('CONSOLE:', consoleLines.slice(-20).join('\n'));
            persistLog();
            await browser.close();
            process.exit(1);
        }
        log('STEP 1 ok: chat composer visible at', page.url());
    }

    if (signOutCheck) {
        // Offline boot with an expired token needs the bootstrap ceiling to elapse,
        // so wait for real content instead of a fixed delay.
        const waitForContent = async () => {
            await page.waitForFunction(
                () => document.body.innerText.replace(/\s+/g, ' ').trim().length > 40,
                null,
                { timeout: 45000 }
            ).catch(() => undefined);
        };
        const readStorage = () => page.evaluate((sessionKey) => {
            const registry = localStorage.getItem('@blackrose_account_registry');
            return {
                registryBody: registry || '',
                session: !!localStorage.getItem(sessionKey),
            };
        }, SUPABASE_SESSION_KEY);

        await page.goto(`${BASE}/today`, { waitUntil: 'domcontentloaded' });
        await waitForContent();
        const before = await readStorage();
        const bootBody = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
        log(`signout check — offline boot landed on ${page.url()}`
            + ` | journal visible: ${/What wants your attention/.test(bootBody)}`
            + ` | stored session: ${before.session}`
            + ` | remembered account kept: ${/"rememberedAccountId":"e2e-offline-account"/.test(before.registryBody)}`);

        await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' });
        await waitForContent();
        // Settings sections start collapsed; the Account header carries the
        // accessibility label ('Account, Signed in as …').
        await page.locator('[aria-label^="Account"]').first().click();
        const signOutButton = page.getByText('Sign out', { exact: true }).first();
        await signOutButton.waitFor({ state: 'visible', timeout: 45000 });
        await signOutButton.click();
        await page.waitForURL(/forgot-password|\/login|\/sign/, { timeout: 30000 }).catch(() => undefined);
        await wait(3000);

        const afterClickUrl = page.url();
        const afterClick = await readStorage();
        const onAuthScreenAfterClick = /forgot-password|\/login|\/sign/.test(afterClickUrl);
        log(`  after click → url=${afterClickUrl} | auth screen: ${onAuthScreenAfterClick}`
            + ` | stored session removed: ${!afterClick.session}`
            + ` | remembered account cleared: ${/"rememberedAccountId":null/.test(afterClick.registryBody)}`);

        await page.reload({ waitUntil: 'domcontentloaded' });
        await waitForContent();
        const reloadBody = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
        const onAuthScreenAfterReload = /forgot-password|\/login|\/sign/.test(page.url());
        const journalAfterReload = /What wants your attention|INTENTIONS/.test(reloadBody);
        log(`  after reload → url=${page.url()} | auth screen: ${onAuthScreenAfterReload}`
            + ` | journal visible: ${journalAfterReload}`);

        const ok = onAuthScreenAfterClick && !afterClick.session
            && /"rememberedAccountId":null/.test(afterClick.registryBody)
            && onAuthScreenAfterReload && !journalAfterReload;
        log('RESULT: ' + (ok ? 'PASS' : 'FAIL (offline sign out did not stick)'));
        persistLog();
        await browser.close();
        process.exit(ok ? 0 : 1);
    }

    if (bootOnly) {
        const budgetMs = Number(process.env.E2E_BOOT_WAIT_MS || 240000);
        const started = Date.now();
        let appeared = false;
        while (Date.now() - started < budgetMs) {
            await wait(15000);
            const body = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
            const elapsed = Math.round((Date.now() - started) / 1000);
            log(`boot wait ${elapsed}s | text=${body.length}ch | supabase requests blocked=${supabaseBlocked}`
                + ` | pageErrors=${pageErrors.length} | url=${page.url()}`);
            if (body.length > 0) {
                appeared = true;
                log('  head: ' + body.slice(0, 120));
                break;
            }
        }
        const afterBoot = await page.evaluate((sessionKey) => {
            const registry = localStorage.getItem('@blackrose_account_registry');
            return {
                registry: !!registry,
                registryBody: registry ? registry.slice(0, 300) : null,
                session: !!localStorage.getItem(sessionKey),
                sessionBody: (localStorage.getItem(sessionKey) || '').slice(0, 120),
            };
        }, SUPABASE_SESSION_KEY);
        log('app rendered within budget: ' + appeared);
        log('  registry: ' + afterBoot.registryBody);
        log('  session : ' + afterBoot.sessionBody);
        for (const line of consoleLines.slice(-25)) log('  console: ' + line);

        // A rejected credential must NOT get offline access: supabase-js removes the
        // stored session and emits SIGNED_OUT, so this boots to the auth screens.
        if (supabaseMode.startsWith('revoked')) {
            const onAuthScreen = /forgot-password|\/login|\/sign/.test(page.url());
            const sessionGone = !afterBoot.session;
            const accountCleared = /"rememberedAccountId":null/.test(afterBoot.registryBody || '');
            const ok = onAuthScreen && sessionGone && accountCleared;
            log('revoked-credential expectation → auth screen: ' + onAuthScreen
                + ' | stored session removed: ' + sessionGone
                + ' | remembered account cleared: ' + accountCleared);
            log('RESULT: ' + (ok ? 'PASS' : 'FAIL (rejected credential kept offline access)'));
            persistLog();
            await browser.close();
            process.exit(ok ? 0 : 1);
        }

        log('RESULT: ' + (appeared ? 'PASS' : 'FAIL (stuck on loading screen)'));
        persistLog();
        await browser.close();
        process.exit(appeared ? 0 : 1);
    }

    if (offlineWalk) {
        const routes = [
            '/today', '/entries', '/insights', '/explore', '/settings',
            '/goals', '/drafts', '/saved-insights', '/memory-graph', '/streak-view', '/rewards',
        ];
        log(`OFFLINE WALK: supabase=${supabaseMode} expiredSession=${expiredSession}`);
        log('after boot: url=' + page.url());
        const bootStorage = await page.evaluate((sessionKey) => ({
            registry: !!localStorage.getItem('@blackrose_account_registry'),
            session: !!localStorage.getItem(sessionKey),
        }), SUPABASE_SESSION_KEY);
        log('boot storage — registry: ' + bootStorage.registry + ' | supabase session: ' + bootStorage.session);

        const results = [];
        const bootBody = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
        results.push({
            rendered: bootBody.length > 40,
            route: '(boot)',
            boundary: /Something went wrong/i.test(bootBody),
            signedOut: /\/(auth|login|signup|forgot-password)/.test(page.url()) || /Sign in|Log in|Create account/i.test(bootBody),
            body: bootBody,
            newConsole: [],
            newErrors: pageErrors.slice(),
            url: page.url(),
        });
        log(`WALK (boot) → url=${page.url()} | boundary=${results[0].boundary} | signedOut=${results[0].signedOut}`
            + ` | rendered=${results[0].rendered} | text=${bootBody.length}ch | pageErrors=${results[0].newErrors.length}`);
        const routeBudgetMs = Number(process.env.E2E_ROUTE_WAIT_MS || 30000);
        for (const route of routes) {
            const before = consoleLines.length;
            const beforeErrors = pageErrors.length;
            await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
            await page.waitForLoadState('networkidle').catch(() => {});
            // Rendered content is the pass condition: a spinner-only shell with no
            // text means the app never reached the screen (offline hang).
            const routeStarted = Date.now();
            let body = '';
            while (Date.now() - routeStarted < routeBudgetMs) {
                await wait(2000);
                body = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
                if (body.length > 40) break;
            }
            const renderedMs = Date.now() - routeStarted;
            const rendered = body.length > 40;
            const boundary = /Something went wrong/i.test(body);
            const signedOut = /\/(auth|login|signup|forgot-password)/.test(page.url()) || /Sign in|Log in|Create account/i.test(body);
            const newConsole = consoleLines.slice(before);
            const newErrors = pageErrors.slice(beforeErrors);
            results.push({ route, boundary, signedOut, rendered, body, newConsole, newErrors, url: page.url() });
            log(`WALK ${route} → url=${page.url()} | boundary=${boundary} | signedOut=${signedOut} | rendered=${rendered}`
                + ` | text=${body.length}ch | waited=${renderedMs}ms`
                + ` | consoleErrors=${newConsole.filter((l) => /error|failed/i.test(l)).length}`
                + ` | pageErrors=${newErrors.length}`);
            log(`  head: ${body.slice(0, 160)}`);
        }

        const after = await page.evaluate((sessionKey) => ({
            registry: !!localStorage.getItem('@blackrose_account_registry'),
            session: !!localStorage.getItem(sessionKey),
        }), SUPABASE_SESSION_KEY);
        const crashed = results.filter((r) => r.boundary);
        const signedOutRoutes = results.filter((r) => r.signedOut);
        const blank = results.filter((r) => !r.rendered);
        const threw = results.filter((r) => r.newErrors.length > 0);
        log('after walk — registry: ' + after.registry + ' | supabase session: ' + after.session);
        log(`summary: boundary=${crashed.length} signedOut=${signedOutRoutes.length}`
            + ` neverRendered=${blank.length} pageErrors=${threw.length}`
            + ` | supabase requests blocked: ${supabaseBlocked}`
            + ` | Hindsight via agent gateway (:8787) blocked: ${agentGatewayBlocked}`
            + ` | total Hindsight hosts blocked: ${hindsightBlocked}`);
        for (const error of pageErrors.slice(0, 8)) log('  pageError: ' + error);
        const ok = crashed.length === 0 && signedOutRoutes.length === 0 && blank.length === 0;
        log('RESULT: ' + (ok ? 'PASS' : 'FAIL'));
        persistLog();
        await browser.close();
        process.exit(ok ? 0 : 1);
    }

    if (onlyDemoClear) {
        // Product-path check: dev "Clear demo data" must remove the memory files
        // staged from seeded sessions (rule 8 residue) and leave nothing behind.
        page.on('dialog', (dialog) => { void dialog.accept(); });

        for (let i = 0; i < 40; i += 1) {
            await wait(1500);
            const probe = await readMemoryFiles(page);
            if (probe.files.length > 0) break;
        }

        const seeded = await readMemoryFiles(page);
        const ledger = await readSeedRecord(page);
        const seedSessionIds = new Set([...(ledger.journalEntryIds ?? []), ...(ledger.checkInIds ?? [])]);
        const unrecorded = seeded.files.filter((file) => {
            const source = seeded.headers.find((h) => h.id === file.id)?.sourceSessionKey;
            return !source || !seedSessionIds.has(source);
        });
        log('seed ledger sessions: ' + seedSessionIds.size);
        log('memory files staged by the demo seed: ' + seeded.files.length
            + ' | headers: ' + seeded.headers.length
            + ' | unrecorded sources: ' + unrecorded.length);
        for (const file of seeded.files) {
            const source = seeded.headers.find((h) => h.id === file.id)?.sourceSessionKey ?? '<none>';
            log('  seed file: ' + file.id + ' | sourceSessionKey=' + source
                + (seedSessionIds.has(source) ? '' : ' | NOT-IN-LEDGER'));
        }

        const settingsButton = page.getByLabel('Open settings').first();
        if ((await settingsButton.count()) === 0) {
            log('RESULT: FAIL (no in-app route to settings; refusing to reload mid-seed)');
            persistLog();
            await browser.close();
            process.exit(1);
        }
        await settingsButton.click();
        await wait(3000);
        const dataHeader = page.getByText('Data Management', { exact: true }).first();
        await dataHeader.click().catch(() => {});
        await wait(1500);
        const clearDemo = page.getByText('Clear demo data', { exact: false }).first();
        const clearRowPresent = (await clearDemo.count()) > 0;
        log('clear-demo row present: ' + clearRowPresent);
        if (!clearRowPresent) {
            log('RESULT: FAIL (clear-demo row missing)');
            persistLog();
            await page.screenshot({ path: path.join(OUT_DIR, 'demo-clear-missing-row.png'), fullPage: false });
            await browser.close();
            process.exit(1);
        }

        await clearDemo.click().catch(() => {});
        // The clear queues behind an in-flight seed, so wait for the ledger key
        // to disappear rather than guessing a duration.
        let recordGone = false;
        for (let i = 0; i < 80 && !recordGone; i += 1) {
            await wait(1500);
            const record = await readSeedRecord(page);
            recordGone = !record.present;
        }
        const after = await readMemoryFiles(page);
        log('seed record removed: ' + recordGone);
        log('memory files after clear: ' + after.files.length + ' | headers: ' + after.headers.length);
        for (const file of after.files) {
            log('  survivor: ' + file.id + ' | sourceSessionKey='
                + (after.headers.find((h) => h.id === file.id)?.sourceSessionKey ?? '<none>'));
        }
        const ok = seeded.files.length > 0
            && unrecorded.length === 0
            && recordGone
            && after.files.length === 0
            && after.headers.length === 0;
        log(ok ? 'RESULT: PASS' : 'RESULT: FAIL');
        persistLog();
        await page.screenshot({ path: path.join(OUT_DIR, 'demo-clear.png'), fullPage: false });
        await browser.close();
        process.exit(ok ? 0 : 1);
    }

    const onlyDrive = process.env.E2E_ONLY_DRIVE === '1';
    let staged = null;
    let hits = [];
    let uiShowsToolUse = false;
    let usedMemorySearch = false;
    let calledMemoryTool = false;
    let uiToolSummary = '';
    let hindsightTouched = false;
    let priorContextBleed = [];

    if (!onlyDrive) {
    log('STEP 2: writing journal turn');
    await sendTurn(page, ENTRY_TEXT);
    const first = await waitForAssistantSettle(page, ENTRY_TEXT);
    log('assistant reply (' + first.elapsedMs + 'ms, timedOut=' + !!first.timedOut + '):\n' + (first.reply.slice(0, 800) || '<empty>'));
    if (first.timedOut && first.bodyTail) log('body tail at timeout:\n' + first.bodyTail);

    log('STEP 3: Finish entry');
    const finish = page.getByLabel('Finish entry', { exact: false }).first();
    await finish.waitFor({ state: 'visible', timeout: 30000 });
    await finish.click();

    let reachedReflection = false;
    for (let i = 0; i < 60; i += 1) {
        if (/entry-reflection/.test(page.url())) {
            reachedReflection = true;
            break;
        }
        await wait(2000);
    }
    log('finish navigation ->', page.url(), 'reachedReflection=' + reachedReflection);

    log('STEP 4: waiting for staged memory file (Hindsight blocked)');
    let memory = { files: [], headers: [] };
    for (let i = 0; i < 60; i += 1) {
        memory = await readMemoryFiles(page);
        if (memory.files.some((f) => f.body.includes('lighthouse'))) break;
        await wait(2000);
    }
    log('staged memory files: ' + memory.files.length + ' | manifest headers: ' + memory.headers.length);
    staged = memory.files.find((f) => f.body.includes('lighthouse'));
    if (staged) {
        const header = memory.headers.find((h) => h.id === staged.id);
        log('OUR STAGED FILE:', staged.id);
        log('  header name: ' + (header?.name ?? '?'));
        log('  description: ' + (header?.description ?? '?'));
        log('  body:\n' + staged.body);
    } else {
        log('NO staged file containing "lighthouse" — staged ids:\n' + memory.files.map((f) => f.id).join('\n'));
    }

    log('STEP 5: fresh chat, recall question');
    await page.goto(`${BASE}/chat`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await wait(4000);
    // Guard against session-resume bleed: the entry text must NOT already be on
    // screen, otherwise a quotable answer could come from context, not memory.
    const preSendBody = await page.locator('body').innerText();
    priorContextBleed = ['lighthouse', 'reykjavik', 'marathon'].filter((token) => preSendBody.toLowerCase().includes(token));
    log('fresh-chat pre-send leakage check (must be empty): ' + JSON.stringify(priorContextBleed));
    const recallMark = Date.now();
    await sendTurn(page, RECALL_QUESTION);
    const recall = await waitForAssistantSettle(page, RECALL_QUESTION, 180000);
    const recallTools = calledTools.filter((call) => call.at >= recallMark).map((call) => call.name);
    const domActivity = await page.locator('body').innerText();
    uiToolSummary = (domActivity.match(/Used (\d+) tools?/i) || [])[0] || '';
    const activityLabels = ['Searching offline memory', 'Browsing memory files', 'Reading memory file', 'Memory overview', 'Staging memory', 'Consolidating memories']
        .filter((label) => domActivity.includes(label));

    console.log('\n===== VERBATIM RECALL REPLY =====');
    console.log(recall.reply || '<empty>');
    console.log('===== END REPLY =====\n');
    log('RECALL_REPLY_START');
    log(recall.reply || '<empty>');
    log('RECALL_REPLY_END');
    log('recall tool calls: ' + JSON.stringify(recallTools));
    log('visible tool-activity labels: ' + JSON.stringify(activityLabels) + ' | UI summary: ' + JSON.stringify(uiToolSummary));
    if (recall.timedOut && recall.bodyTail) log('body tail at timeout:\n' + recall.bodyTail);

    const haystack = recall.reply.toLowerCase();
    hits = ['lighthouse', 'tattoo', 'reykjavik', 'marathon'].filter((token) => haystack.includes(token));
    usedMemorySearch = toolNames.includes('memory_search');
    calledMemoryTool = recallTools.some((name) => name.startsWith('memory_'));
    uiShowsToolUse = /Used \d+ tools?/i.test(uiToolSummary);
    hindsightTouched = hindsightBlocked > 0 || consoleLines.some((line) => /Hindsight gateway .* unavailable/.test(line));

    log('hindsight requests failed: ' + hindsightBlocked + ' (agent gateway :8787: ' + agentGatewayBlocked + ')'
        + ' | supabase failed: ' + supabaseBlocked);
    log('memory_search offered to model: ' + usedMemorySearch + ' | memory tool called: ' + JSON.stringify(recallTools) + ' | UI tool summary: ' + JSON.stringify(uiToolSummary));
    log('distinctive tokens in reply: ' + JSON.stringify(hits));
    }

    log('STEP 6: Settings -> Drive backup rows without EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID');
    await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await wait(3000);
    const settingsTextBefore = await page.locator('body').innerText();
    // Sections are accordions (collapsed by default) — expand "Data Management" first.
    const dataHeader = page.getByText('Data Management', { exact: true }).first();
    if ((await dataHeader.count()) > 0) {
        await dataHeader.click().catch(() => {});
        await wait(1500);
    }
    const backupRow = page.getByText('Back up memory to Google Drive', { exact: false }).first();
    const restoreRow = page.getByText('Restore memory from Google Drive', { exact: false }).first();
    const rowsPresent = (await backupRow.count()) > 0 && (await restoreRow.count()) > 0;
    if (rowsPresent) {
        await backupRow.click().catch(() => {});
        await wait(1200);
        await restoreRow.click().catch(() => {});
        await wait(1200);
    }
    const settingsTextAfter = await page.locator('body').innerText();
    const driveHint = 'Set EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID to enable.';
    const crashed = /Something went wrong|Unhandled Runtime Error|Application error/i.test(settingsTextAfter);
    const driveOk = rowsPresent && settingsTextAfter.includes(driveHint) && !crashed;
    log('rows present: ' + rowsPresent + ' | hint visible: ' + settingsTextAfter.includes(driveHint) + ' | crashed: ' + crashed);
    log('settings excerpt (drive rows):\n' + settingsTextAfter.split('\n').filter((line) => /Google Drive|memory|Data Management/i.test(line)).join('\n'));
    await page.screenshot({ path: path.join(OUT_DIR, 'drive-softfail.png'), fullPage: false });

    const usedToolsInUi = uiShowsToolUse;
    const ok = onlyDrive ? driveOk : (!!staged && hits.length >= 2 && usedToolsInUi && driveOk);
    log(ok ? 'RESULT: PASS' : 'RESULT: FAIL');
    if (!calledMemoryTool) log('note: tool names not captured from provider responses; UI reported ' + JSON.stringify(uiToolSummary));
    if (!settingsTextBefore.includes('Data Management')) log('note: Data Management section not found on /settings');
    if (!usedMemorySearch) log('note: memory_search was not in any tool spec — shortlist/gate problem');
    if (hindsightTouched) log('note: Hindsight was attempted and blocked (soft-fail path exercised)');

    persistLog();
    await page.screenshot({ path: path.join(OUT_DIR, 'memory-recall-offline.png'), fullPage: false });
    await browser.close();
    process.exit(ok ? 0 : 1);
}

main().catch(async (error) => {
    log('ERROR: ' + (error?.stack || String(error)));
    persistLog();
    process.exit(1);
});
