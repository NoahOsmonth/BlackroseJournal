/**
 * Insight action dock probe — the reported bug, measured in a real browser.
 *
 * The report: pressing a non-button area of the insight options sheet did not
 * dismiss it, so the only reliable exit was the Cancel row. The sheet is gone
 * (replaced by an in-card dock), and this probe checks the replacement rather
 * than trusting the unit tests: it opens the dock, reads its geometry, and tries
 * every dismissal route — including presses on dead space, which is the case
 * that used to do nothing.
 *
 * Run against a live dev server (expo start --web):
 *   node scripts/qa/insight-dock-qa.mjs
 *   E2E_BASE_URL=http://localhost:8081 QA_SHOT_DIR=/tmp/shots node scripts/qa/insight-dock-qa.mjs
 *
 * Exits non-zero if any check fails. Screenshots land in QA_SHOT_DIR (default
 * /tmp/insight-dock-qa) so a QA run never writes into the repo.
 */

import pw from 'playwright';
import { mkdirSync } from 'node:fs';

const { chromium } = pw;

const BASE = process.env.E2E_BASE_URL || 'http://localhost:8081';
const SHOTS = process.env.QA_SHOT_DIR || '/tmp/insight-dock-qa';
const VIEWPORT = { width: 390, height: 844 };
const FLOOR = 44;
const ACTIONS = ['Share', 'Copy', 'Saved insights', 'Hide for today'];
const TRIGGER = '[aria-label="More options"]';
const QUESTION = '[aria-label="Open insight conversation"]';

let failures = 0;
function check(label, ok, detail = '') {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
}
const round = (n) => Math.round(n * 10) / 10;

/** Switch scheme the way a user does: Settings → Appearance → radio. */
async function setScheme(page, mode) {
    await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);
    await page.getByRole('button', { name: /^Appearance/ }).click();
    await page.waitForTimeout(1000);
    await page.getByRole('radio', { name: `Select ${mode} theme` }).click();
    await page.waitForTimeout(1200);
}

async function openToday(page) {
    await page.goto(`${BASE}/today`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    await page.locator(TRIGGER).first().waitFor({ state: 'visible', timeout: 15000 });
    // The dock floor is the card's bottom edge, which sits under the floating
    // BottomNav until the scroll view is at its end — and a press there would be
    // silently swallowed by the nav instead of reaching the dock.
    const scroll = await page.evaluate(() => {
        let node = document.querySelector('[aria-label="More options"]');
        while (node) {
            const style = getComputedStyle(node);
            if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) {
                node.scrollTop = node.scrollHeight;
                return { top: Math.round(node.scrollTop), max: node.scrollHeight - node.clientHeight };
            }
            node = node.parentElement;
        }
        return null;
    });
    await page.waitForTimeout(400);
    console.log(`INFO  scrolled to end: ${JSON.stringify(scroll)}`);
}

/** Which of the four actions are currently mounted. */
function visibleActions(page) {
    return page.evaluate(
        (labels) => labels.filter((label) => document.querySelector(`[aria-label="${label}"]`)),
        ACTIONS
    );
}

async function boxOf(page, label) {
    const el = page.locator(`[aria-label="${label}"]`).first();
    if ((await el.count()) === 0) return null;
    return el.boundingBox();
}

/** The card is the trigger's nearest bordered ancestor (hairline + radius-card). */
function cardRect(page) {
    return page.evaluate(() => {
        let node = document.querySelector('[aria-label="More options"]');
        while (node && node !== document.body) {
            const style = getComputedStyle(node);
            if (parseFloat(style.borderTopWidth) > 0 && parseFloat(style.borderRadius) >= 12) {
                const rect = node.getBoundingClientRect();
                return {
                    height: rect.height,
                    border: style.borderTopColor,
                    background: style.backgroundColor,
                };
            }
            node = node.parentElement;
        }
        return null;
    });
}

async function press(page, selector) {
    await page.locator(selector).first().click();
    await page.waitForTimeout(350);
}

async function probeScheme(page, scheme) {
    console.log(`\n--- ${scheme.toUpperCase()} ---`);
    await setScheme(page, scheme);
    await openToday(page);

    const closedCard = await cardRect(page);
    check('the insight card renders', !!closedCard, closedCard ? `h=${round(closedCard.height)}` : 'not found');
    check('actions are absent while closed', (await visibleActions(page)).length === 0);

    await press(page, TRIGGER);
    const opened = await visibleActions(page);
    check('the trigger opens all four actions', opened.length === 4, opened.join(', '));
    check('no Cancel row exists', !(await page.locator('[aria-label="Cancel"]').count()));

    for (const label of ['More options', 'Refresh insight', 'Save insight', ...ACTIONS]) {
        const box = await boxOf(page, label);
        const ok = box && box.width >= FLOOR && box.height >= FLOOR;
        check(
            `"${label}" clears the ${FLOOR}px floor`,
            !!ok,
            box ? `${round(box.width)}x${round(box.height)}` : 'missing'
        );
    }

    const openCard = await cardRect(page);
    console.log(
        `INFO  card height closed=${round(closedCard.height)} open=${round(openCard.height)}` +
            ` (grows ${round(openCard.height - closedCard.height)}px)`
    );
    console.log(`INFO  card border ${openCard.border} on ${openCard.background}`);

    // The dock grows the card at the very bottom of the scroll view, where the
    // floating BottomNav overlaps content. Opening it must pull itself clear —
    // an action strip whose labels sit behind the nav is the same class of bug
    // as the sheet the user could not dismiss.
    await page.waitForTimeout(500);
    const clearance = await page.evaluate(() => {
        const rect = (el) => (el ? el.getBoundingClientRect() : null);
        const action = document.querySelector('[aria-label="Share"]');
        const dock = rect(action ? action.parentElement : null);
        let node = document.querySelector('[aria-label="Today"]');
        while (node && node !== document.body) {
            const style = getComputedStyle(node);
            if (style.position === 'absolute' || style.position === 'fixed') break;
            node = node.parentElement;
        }
        const nav = rect(node === document.body ? null : node);
        return dock && nav ? { dockBottom: Math.round(dock.bottom), navTop: Math.round(nav.top) } : null;
    });
    check(
        'the open dock clears the BottomNav without scrolling',
        clearance && clearance.dockBottom <= clearance.navTop,
        clearance ? `dock bottom ${clearance.dockBottom} vs nav top ${clearance.navTop}` : 'not measured'
    );

    // The strip is role=menu, so a press on its padding can be aimed at the
    // container: Playwright's actionability check then fails loudly if the
    // BottomNav is intercepting the point rather than clicking through it.
    const menu = page.getByRole('menu');
    check('the dock exposes role=menu', (await menu.count()) === 1);
    await menu.click({ position: { x: 4, y: 34 } });
    await page.waitForTimeout(350);
    check("a press on the dock's own padding dismisses", (await visibleActions(page)).length === 0);

    const urlBefore = page.url();
    await press(page, TRIGGER);
    await press(page, QUESTION);
    check('a press on the card body dismisses', (await visibleActions(page)).length === 0);
    check('…and does not navigate away', page.url() === urlBefore, page.url().replace(BASE, ''));

    await press(page, TRIGGER);
    await press(page, TRIGGER);
    check('the trigger toggles the dock closed', (await visibleActions(page)).length === 0);

    await page.screenshot({ path: `${SHOTS}/today-${scheme.toLowerCase()}-closed.png` });
    await press(page, TRIGGER);
    await page.screenshot({ path: `${SHOTS}/today-${scheme.toLowerCase()}-open.png` });

    await press(page, '[aria-label="Hide for today"]');
    check('"Hide for today" removes the card', (await page.locator(TRIGGER).count()) === 0);
}

mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
const page = await context.newPage();

const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

for (const scheme of ['Light', 'Dark']) {
    await probeScheme(page, scheme);
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
check('no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
console.log(`screenshots: ${SHOTS}`);

await browser.close();
process.exit(failures === 0 ? 0 : 1);
