/**
 * Resolve a Chromium binary for Playwright.
 *
 * `npx playwright install` may be unavailable or the browser revision bundled
 * with the installed `playwright-core` may be missing while another revision is
 * already on disk, so fall back to the newest cached `chromium-*` build.
 * `PW_CHROME_PATH` overrides everything.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

function cacheRoots() {
  const roots = [];
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) roots.push(process.env.PLAYWRIGHT_BROWSERS_PATH);
  if (process.platform === 'win32') {
    if (process.env.LOCALAPPDATA) roots.push(path.join(process.env.LOCALAPPDATA, 'ms-playwright'));
  } else if (process.platform === 'darwin') {
    roots.push(path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright'));
  } else {
    roots.push(path.join(os.homedir(), '.cache', 'ms-playwright'));
  }
  return roots;
}

/** Newest cached full Chromium build, or null. */
export function findCachedChrome() {
  if (process.env.PW_CHROME_PATH) return process.env.PW_CHROME_PATH;
  const candidates = [];
  for (const root of cacheRoots()) {
    let entries = [];
    try {
      entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || !/^chromium-\d+$/.test(entry.name)) continue;
      const revision = Number(entry.name.split('-')[1]);
      const exe = process.platform === 'win32'
        ? path.join(root, entry.name, 'chrome-win64', 'chrome.exe')
        : process.platform === 'darwin'
          ? path.join(root, entry.name, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium')
          : path.join(root, entry.name, 'chrome-linux', 'chrome');
      if (fs.existsSync(exe)) candidates.push({ revision, exe });
    }
  }
  candidates.sort((a, b) => b.revision - a.revision);
  return candidates.length ? candidates[0].exe : null;
}

/** Launch options that work whether or not the bundled revision is installed. */
export function launchOptions(overrides = {}) {
  const executablePath = findCachedChrome();
  return executablePath ? { ...overrides, executablePath } : overrides;
}
