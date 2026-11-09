/**
 * Every screen is in the touch audit, or says why it cannot be (Kaneo #111).
 *
 * Round 69 found the audit reporting clean because it measured nothing: /photos
 * was never in its route list, and the photo controls did not exist during the
 * sweep. A new route can escape the same way, so this compares the routes that
 * exist against the routes that are swept.
 *
 * This is a source check by design. The audit itself runs in a real browser; this
 * only guarantees the audit is pointed at everything.
 */
import fs from 'fs';
import path from 'path';

import { relPosix } from '../mocks/repoPath';

const ROOT = process.cwd();

/** Screens that need a record id, so a bare route renders an empty state. */
const NEEDS_DATA = ['/entry-detail', '/chat'];

/** Screens deliberately not swept, each with a reason. */
const EXEMPT: Record<string, string> = {
    '/_layout': 'the router shell, not a screen',
    '/index': 'the boot redirect, not a screen',
    '/checkin-detail': 'needs a check-in id; entry-detail is the swept sibling',
    '/entry-reflection': 'needs an entry id like entry-detail, covered by it',
    '/crash-logs': 'developer surface, not part of the writing loop',
    '/memory-graph': 'a canvas: the audit measures DOM targets, not canvas paint',
};

function routeFiles(): string[] {
    const files = fs.readdirSync(path.join(ROOT, 'app'));
    return files
        .filter((name) => name.endsWith('.tsx'))
        .map((name) => '/' + name.replace(/\.tsx$/, '').replace('index', 'index'));
}

function auditSource(): string {
    return fs.readFileSync(path.join(ROOT, 'scripts/qa/touch-targets.mjs'), 'utf8');
}

describe('touch audit coverage', () => {
    it('sweeps every screen that exists', () => {
        const source = auditSource();
        const missing: string[] = [];
        for (const route of routeFiles()) {
            if (EXEMPT[route]) continue;
            // A route counts as covered if it appears as a literal in the script.
            if (!source.includes("'" + route + "'")) missing.push(route);
        }
        expect(missing).toEqual([]);
    });

    it('keeps every exemption justified, and none of them secret', () => {
        const source = auditSource();
        for (const route of Object.keys(EXEMPT)) {
            expect(EXEMPT[route].length).toBeGreaterThan(10);
            // An exempt route must not quietly appear in the sweep either: the
            // exemption and the sweep disagreeing is how a screen gets half-audited.
            expect(source.includes("'" + route + "'")).toBe(false);
        }
    });

    it('knows which screens need data before they render anything', () => {
        const source = auditSource();
        for (const route of NEEDS_DATA) {
            expect(source.includes(route)).toBe(true);
        }
    });

    it('skips only screens it named a reason for', () => {
        const swept = auditSource();
        const unexplained = routeFiles().filter(
            (route) => !EXEMPT[route] && !swept.includes("'" + route + "'"),
        );
        expect(unexplained).toEqual([]);
    });

    it('has a repo-relative path helper available to it', () => {
        expect(relPosix(ROOT, path.join(ROOT, 'app/today.tsx'))).toBe('app/today.tsx');
    });
});
