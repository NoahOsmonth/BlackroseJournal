/**
 * Touch-target + readable-text audit for the main routes.
 *
 * Reports, per route and per scheme: how many pressables are under 44x44, how
 * many have no accessible name, how many text leaves fall below 3:1 contrast,
 * and whether the page scrolls sideways.
 *
 * LIMITATION, deliberate: hitSlop widens the touch area without changing the
 * element's rect, so a small rect here is a CANDIDATE, not a defect. Confirm in
 * source before "fixing" one - the header's 36x36 gear with hitSlop 8 is a 52px
 * target and is fine. The real defects found this way were inline text chips
 * with hitSlop 4-6, which no amount of slop can lift to 44px.
 *
 * Usage:
 *   PW_CHROME_PATH=... node scripts/qa/touch-targets.mjs
 *   PW_CHROME_PATH=... node scripts/qa/touch-targets.mjs --json
 */
import { chromium } from 'playwright';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:8081';
const SCHEMES = ['light', 'dark'];

/**
 * Static routes plus the ones that need a real record to render. Entry detail
 * and chat were never swept before round 56 because they open on an empty or
 * "not found" state without an id, and an empty state measures like a good
 * screen.
 */
const STATIC_ROUTES = [
    '/today', '/insights', '/explore', '/entries', '/settings',
    '/goals', '/prompt-shelf', '/on-this-day', '/streak-view', '/drafts',
    '/photos',
    // Added in round 70: eleven screens existed that the sweep had never opened
    // (Kaneo #111). They are static routes, so they cost nothing but a page load.
    '/ask-rosebud', '/happiness-recipe', '/letters', '/monthly-review', '/rewards',
    '/saved-insights', '/streak-haiku', '/suggestions', '/writing-goal', '/writing-year',
];
const asJson = process.argv.includes('--json');

const PROBE = () => {
    const rgb = (s) => {
        const m = (s || '').match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const p = m[1].split(',').map(Number);
        return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const lum = (c) => {
        const f = (v) => {
            const n = v / 255;
            return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const ratio = (a, b) => {
        const l1 = lum(a);
        const l2 = lum(b);
        const hi = Math.max(l1, l2);
        const lo = Math.min(l1, l2);
        return (hi + 0.05) / (lo + 0.05);
    };
    const bgOf = (el) => {
        let n = el;
        while (n && n !== document.documentElement) {
            const c = rgb(getComputedStyle(n).backgroundColor);
            if (c && c.a > 0.5) return c;
            n = n.parentElement;
        }
        return rgb(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
    };
    const visible = (el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return false;
        const s = getComputedStyle(el);
        return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05;
    };
    const name = (el) => (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim();

    const targets = [...document.querySelectorAll('[role=button],button,a,[tabindex]')].filter(visible);
    const small = targets
        .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width < 44 || r.height < 44;
        })
        .map((el) => {
            const r = el.getBoundingClientRect();
            const w = Math.round(r.width);
            const h = Math.round(r.height);
            // hitSlop is invisible to the DOM, so a candidate needs judgement.
            // Below 24px a target would need more than 10px of slop on every
            // side, which is where hit areas start colliding with their
            // neighbours - that is the class that cannot be rescued, and the
            // class the round 55 sweep found (12px tag chips, a 22px link).
            // Everything from 24px up is a candidate: confirm hitSlop in source.
            // Height is the axis that fails in a list; a short word can be
            // narrow forever without being a miss zone as long as the row is
            // tall and neighbours are separated.
            return { name: name(el).slice(0, 40), w, h, defect: h < 24 || (w < 24 && h < 32) };
        });
    const unnamed = targets.filter((el) => name(el).length === 0).length;

    const leaves = [...document.querySelectorAll('div,span,p,h1,h2,h3,label')]
        .filter((el) => el.children.length === 0 && el.textContent.trim().length > 0 && visible(el));
    const low = [];
    for (const el of leaves) {
        const fg = rgb(getComputedStyle(el).color);
        if (!fg) continue;
        const r = ratio(fg, bgOf(el));
        if (r < 3) low.push({ text: el.textContent.trim().slice(0, 40), ratio: Math.round(r * 10) / 10 });
    }

    const doc = document.scrollingElement || document.documentElement;
    return {
        targets: targets.length,
        small: small.length,
        defects: small.filter((s) => s.defect).length,
        smallSamples: small.sort((a, b) => a.h - b.h).slice(0, 8),
        unnamed,
        textLeaves: leaves.length,
        lowContrast: low.length,
        lowSamples: low.slice(0, 8),
        overflowX: doc.scrollWidth - doc.clientWidth,
    };
};

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME_PATH });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));

/** Pull a real entry id out of the account-scoped journal key. */
async function findEntryId() {
    await page.goto(BASE + '/entries', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);
    // The key is account-scoped (`@blackrose_account:v1:<acct>:journal_entries`)
    // and the payload nests `entries` as an id-keyed map, not an array. A probe
    // that assumes `@journal_entries` finds nothing and silently skips entry
    // detail - which is exactly what happened on the first run of this sweep.
    return page.evaluate(() => {
        const keys = Object.keys(localStorage);
        const exact = keys.find((k) => k.endsWith(':journal_entries'));
        const shard = keys.find((k) => k.includes(':journal_entries_shard:'));
        for (const key of [exact, shard].filter(Boolean)) {
            try {
                const raw = JSON.parse(localStorage.getItem(key));
                const bag = raw && raw.entries ? raw.entries : raw;
                const ids = Array.isArray(bag) ? bag.map((row) => row && row.id) : Object.keys(bag || {});
                const first = ids.find((id) => typeof id === 'string' && id.length > 0);
                if (first) return first;
            } catch {
                continue;
            }
        }
        return null;
    });
}

const entryId = await findEntryId();
const ROUTES = [
    ...STATIC_ROUTES,
    ...(entryId ? ['/entry-detail?id=' + entryId, '/chat'] : ['/chat']),
];
if (!asJson) console.log('entry id: ' + (entryId || 'none found - entry detail skipped'));
else console.error('entry id: ' + (entryId || 'none found - entry detail skipped'));

/**
 * Give one entry a photo before sweeping (Kaneo #110).
 *
 * Without this the photo controls never exist: the Remove button only renders on
 * an entry that has a photo, so an empty-state sweep reports the screen clean and
 * measures none of it. The same photo also lets the viewer be opened and measured.
 */
const seedPhoto = async (id) => {
    await page.evaluate((entryId) => {
        const key = Object.keys(localStorage).find(
            (k) => k.includes(':journal_entries') && !k.includes('_shard'),
        );
        if (!key) return;
        const prefix = key.slice(0, key.lastIndexOf(':') + 1);
        const canvas = document.createElement('canvas');
        canvas.width = 1200;
        canvas.height = 800;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = 'rgb(90, 110, 150)';
        ctx.fillRect(0, 0, 1200, 800);
        localStorage.setItem(
            prefix + 'blackrose_entry_photo:' + entryId,
            JSON.stringify({
                schemaVersion: 1,
                dataUrl: canvas.toDataURL('image/jpeg', 0.9),
                width: 1200,
                height: 800,
                updatedAt: Date.now(),
            }),
        );
        localStorage.setItem(
            prefix + 'blackrose_entry_photo_index',
            JSON.stringify({ schemaVersion: 1, rows: [{ entryId, updatedAt: Date.now() }] }),
        );
    }, id);
};

const results = [];
for (const scheme of SCHEMES) {
    await page.goto(BASE + '/today', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);
    await page.evaluate((s) => localStorage.setItem('user-theme-preference', s), scheme);
    if (entryId) await seedPhoto(entryId);
    for (const route of ROUTES) {
        await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(5000);
        const r = await page.evaluate(PROBE);
        results.push({ scheme, route, ...r });

        // The viewer is an overlay on the entry, not a route: open it and measure
        // what a thumb can actually reach while it is up (Kaneo #110).
        if (entryId && route.startsWith('/entry-detail')) {
            await page.evaluate(() => {
                const open = document.querySelector('[data-testid=entry-photo-open]');
                if (open) open.click();
            });
            await page.waitForTimeout(1500);
            const viewer = await page.evaluate(PROBE);
            results.push({ scheme, route: route + ' + viewer', ...viewer });
            await page.evaluate(() => {
                const close = document.querySelector('[data-testid=photo-viewer-close]');
                if (close) close.click();
            });
            await page.waitForTimeout(800);
        }
    }
    if (entryId) {
        await page.evaluate(() => {
            for (const k of Object.keys(localStorage)) {
                if (k.includes('blackrose_entry_photo')) localStorage.removeItem(k);
            }
        });
    }
}
await browser.close();

if (asJson) {
    console.log(JSON.stringify({ results, errors }, null, 2));
} else {
    for (const r of results) {
        console.log(
            [r.scheme, r.route.padEnd(10), 'targets=' + r.targets, 'small=' + r.small,
                'defects=' + r.defects, 'unnamed=' + r.unnamed,
                'lowContrast=' + r.lowContrast, 'overflowX=' + r.overflowX].join(' ')
        );
    }
    const worst = results.reduce((a, b) => (b.small > a.small ? b : a));
    console.log('worst route: ' + worst.scheme + ' ' + worst.route + ' with ' + worst.small + ' small targets');
    console.log('page errors: ' + errors.length);
    if (errors.length) console.log(errors.slice(0, 5).join('\n'));
}
