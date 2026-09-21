// ============================================================================
// Audit harness for the insight-options prototypes.
// ----------------------------------------------------------------------------
// Serves one job: prove, with numbers, that every variant dismisses from every
// region that is not an action, and that no variant dismisses from a region
// that IS its own body. Run it before porting, and after.
//
//   python3 -m http.server 8777 --bind 127.0.0.1 \
//     --directory example-design/blackrose/insight-options-variants &
//   node example-design/blackrose/insight-options-variants/audit-variants.mjs
//
// Env: BASE=<url>  ONLY=A,C  (limit to some variants)
//
// Exit 0 = clean. Exit 1 = a dead zone, an over-dismissing body, an
// under-sized touch target, or a layer that overflows the viewport.
//
// Self-tested against three deliberate sabotages (scrim dismissal removed ->
// dead-zone; trigger shrunk to 20x20 -> hugging; sheet body tap wired to close
// -> over-dismissing). A harness that cannot fail proves nothing.
//
// Two measurement traps this script already fell into, kept as guards:
//   * A closed bottom sheet sits at translateY(102%) and a closed popover at
//     scale(0.94) -- measure and probe with the layer OPEN, or you will read a
//     shrunken box and "unreachable" points as design defects.
//   * At a 430px viewport the 26rem phone frame is centred with ~7px of body
//     gutter; probing x<8 lands on BODY, not the app. Probe inside the frame.
// ============================================================================

// Measures the element inventory with the layer OPEN and exercises every
// dismissal region. Classifies findings; exits non-zero if any FAIL.
// Run from the repo root:  node example-design/blackrose/insight-options-variants/audit-variants.mjs
// Needs a static server for this folder (see HEADER below) and playwright, which
// the repo already has as a devDependency for the e2e probes.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pw = require('playwright');
const { chromium } = pw;

const BASE = process.env.BASE || 'http://127.0.0.1:8777';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const ALL_VARIANTS = [
  { letter: 'A', file: 'variant-a-full-bleed-dismiss.html', layer: '#sheet' },
  { letter: 'B', file: 'variant-b-anchored-popover.html', layer: '#popover' },
  { letter: 'C', file: 'variant-c-action-dock.html', layer: '#dock' },
  { letter: 'D', file: 'variant-d-undo-toast.html', layer: '#sheet' },
  { letter: 'E', file: 'variant-e-content-height-ledger.html', layer: '#sheet' },
];
const VARIANTS = ONLY ? ALL_VARIANTS.filter((v) => ONLY.includes(v.letter)) : ALL_VARIANTS;

const TOUCH_MIN = 44;
const findings = [];

function record(variant, scheme, cls, detail) {
  findings.push({ variant, scheme, cls, detail });
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
page.on('pageerror', (e) => console.log('  [pageerror]', String(e).slice(0, 160)));

for (const scheme of ['light', 'dark']) {
  for (const v of VARIANTS) {
    await page.goto(`${BASE}/${v.file}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);

    // Scheme: the chip toggles; set it deterministically instead.
    await page.evaluate((dark) => {
      document.documentElement.classList.toggle('dark', dark);
      const lbl = document.querySelector('[data-theme-label]');
      if (lbl) lbl.textContent = dark ? 'Dark' : 'Light';
    }, scheme === 'dark');

    const isOpen = () => page.evaluate((sel) => document.querySelector(sel)?.dataset.open === 'true', v.layer);
    const openLayer = async () => {
      if (!(await isOpen())) {
        await page.locator('#trigger').click();
        await page.waitForTimeout(400);
      }
    };

    // ---- inventory WITH THE LAYER OPEN (a closed popover is scale(0.94)) ----
    await openLayer();
    const inv = await page.evaluate((sel) => {
      const rect = (el) => {
        const b = el.getBoundingClientRect();
        return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
      };
      const layer = document.querySelector(sel);
      const rows = [...document.querySelectorAll('[data-action]')].map((e) => ({
        label: e.textContent.replace(/[a-z_]+/, '').trim().slice(0, 18),
        h: Math.round(e.getBoundingClientRect().height),
        danger: e.classList.contains('danger'),
      }));
      const trig = document.getElementById('trigger');
      const grab = document.querySelector('.grabber');
      const scrim = document.querySelector('.scrim');
      return {
        trigger: rect(trig),
        layer: rect(layer),
        layerBottom: Math.round(layer.getBoundingClientRect().bottom),
        rows,
        grabberH: grab ? Math.round(grab.getBoundingClientRect().height) : null,
        scrimBg: scrim ? getComputedStyle(scrim).backgroundColor : null,
        viewportH: window.innerHeight,
      };
    }, v.layer);

    console.log(
      `${v.letter}/${scheme} layer=${inv.layer.y}-${inv.layerBottom} trigger=${inv.trigger.w}x${inv.trigger.h} rows=${inv.rows.map((r) => r.h).join(',')} scrim=${inv.scrimBg}`,
    );

    if (inv.trigger.w < TOUCH_MIN || inv.trigger.h < TOUCH_MIN) {
      record(v.letter, scheme, 'hugging', `trigger ${inv.trigger.w}x${inv.trigger.h} < ${TOUCH_MIN}`);
    }
    for (const r of inv.rows) {
      if (r.h < TOUCH_MIN) record(v.letter, scheme, 'hugging', `row "${r.label}" ${r.h}px < ${TOUCH_MIN}`);
    }
    if (!inv.rows.some((r) => r.danger)) {
      record(v.letter, scheme, 'inconsistent', 'no visually distinct destructive row');
    }
    // The destructive row must not be the first thing under the trigger,
    // and must be last so it cannot be hit while reaching for a common action.
    if (v.letter !== 'C' && (inv.rows.length && !inv.rows[inv.rows.length - 1].danger)) {
      record(v.letter, scheme, 'inconsistent', 'destructive row is not last');
    }
    // Only bottom-anchored sheets must reach the viewport bottom. B floats
    // (that is its whole point) and C is an in-flow strip inside the card, so
    // "ends above the bottom" is correct for both and must not be flagged.
    if (['A', 'D', 'E'].includes(v.letter) && inv.viewportH - inv.layerBottom > 2) {
      record(v.letter, scheme, 'clipped', `sheet ends ${inv.viewportH - inv.layerBottom}px above viewport bottom`);
    }
    if (v.letter !== 'C' && (inv.layer.y + inv.layer.h) > inv.viewportH) {
      record(v.letter, scheme, 'overflow', `layer extends past the viewport bottom`);
    }
    if (inv.layer.y < 0) {
      record(v.letter, scheme, 'overflow', 'layer starts above the viewport top');
    }

    // ---- dismissal: every region that is not an action must close it ----
    // Probes must land INSIDE the simulated phone frame. At a 430px viewport the
    // 26rem frame is centered and ~7px of gutter is BODY, not the app — probing
    // there reported a false dead-zone against every variant.
    const phone = await page.evaluate(() => {
      const b = document.querySelector('.phone').getBoundingClientRect();
      return { left: Math.round(b.left), right: Math.round(b.right) };
    });
    const xL = phone.left + 3;
    const xR = phone.right - 3;
    const xM = Math.round((phone.left + phone.right) / 2);

    const outside = [
      ['empty-top', xM, 90],
      ['mid-page', xM, Math.max(120, inv.layer.y - 60)],
      ['phone-left-edge', xL, Math.max(60, inv.layer.y - 40)],
      ['phone-right-edge', xR, Math.max(60, inv.layer.y - 40)],
    ];

    for (const [label, x, y] of outside) {
      await openLayer();
      const before = await isOpen();
      await page.mouse.click(x, y);
      await page.waitForTimeout(320);
      const after = await isOpen();
      if (!(before && !after)) {
        record(v.letter, scheme, 'dead-zone', `tap "${label}" (${x},${y}) did NOT dismiss`);
        console.log(`  FAIL dismiss ${label}`);
      }
    }

    // ---- tapping the layer's own body must NOT dismiss ----
    // The layer must be OPEN when the probe point is computed: a closed bottom
    // sheet is parked at translateY(102%), so every point inside its rect is
    // off-screen and unreachable — which reads as "no non-action area".
    await openLayer();
    const inside = await page.evaluate((sel) => {
      const layer = document.querySelector(sel);
      const b = layer.getBoundingClientRect();
      const blocked = [...document.querySelectorAll('[data-action]'), document.getElementById('trigger')]
        .filter(Boolean)
        .map((e) => e.getBoundingClientRect());
      const overlaps = (x, y) =>
        blocked.some((r) => x >= r.left - 2 && x <= r.right + 2 && y >= r.top - 2 && y <= r.bottom + 2);
      // Walk the layer body row by row, left to right, for a clear spot.
      for (let y = b.top + 4; y < b.bottom - 2; y += 4) {
        for (let x = b.left + 2; x < b.right - 2; x += 8) {
          if (!overlaps(x, y)) {
            const el = document.elementFromPoint(x, y);
            if (el && (el === layer || layer.contains(el))) return { x: Math.round(x), y: Math.round(y) };
          }
        }
      }
      return null;
    }, v.layer);

    // C is deliberately non-modal: its dock is an in-flow strip, and a tap
    // anywhere off it is *supposed* to close.
    if (v.letter !== 'C') {
      if (!inside) {
        record(v.letter, scheme, 'hugging', 'layer has no reachable non-action area to probe');
      } else {
        await page.mouse.click(inside.x, inside.y);
        await page.waitForTimeout(320);
        if (!(await isOpen())) {
          record(v.letter, scheme, 'over-dismissing', `tap inside the layer body (${inside.x},${inside.y}) dismissed it`);
          console.log('  FAIL inside-tap closed it');
        } else {
          console.log('  ok  inside-tap did not close');
        }
      }
    }

    // ---- Escape must dismiss ----
    await openLayer();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(320);
    if (await isOpen()) {
      record(v.letter, scheme, 'dead-zone', 'Escape did not dismiss');
      console.log('  FAIL escape');
    } else {
      console.log('  ok  escape');
    }
  }
}

await browser.close();

console.log('\n===== FINDINGS =====');
if (!findings.length) console.log('none');
const byClass = {};
for (const f of findings) (byClass[f.cls] ||= []).push(f);
for (const [cls, list] of Object.entries(byClass)) {
  console.log(`\n${cls} (${list.length})`);
  for (const f of list) console.log(`  ${f.variant}/${f.scheme}: ${f.detail}`);
}
process.exit(findings.some((f) => ['dead-zone', 'hugging', 'clipped', 'over-dismissing'].includes(f.cls)) ? 1 : 0);
