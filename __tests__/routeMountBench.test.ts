import fs from 'fs';
import path from 'path';
import { relPosix } from './mocks/repoPath';

/**
 * Kaneo #49 / DEF-034: the cold-mount bench scored every route on when its DOCK
 * tab appeared, which is the shell mounting, not the screen's content. That made
 * every route look faster than the wait a writer actually feels, and let Threads
 * be reported as a 2.3-4.1 s outlier that never reproduced.
 *
 * These assertions are cheap and would have caught it: every route must name a
 * content marker, the markers must be content rather than the dock, and no route
 * may fall back to the dock selector.
 */
describe('route-mount-bench measures content, not the dock', () => {
    const source = fs.readFileSync(
        path.join(process.cwd(), 'scripts/qa/route-mount-bench.mjs'),
        'utf8',
    );

    it('gives every route its own content marker', () => {
        const routeBlock = source.slice(source.indexOf('const ROUTES'), source.indexOf('const ROUTE_KEYS'));
        const routes = routeBlock.match(/^  \w+: \{.*\},$/gm) ?? [];
        expect(routes).toHaveLength(4);
        for (const line of routes) {
            expect(line).toMatch(/content: '\[data-testid/);
        }
    });

    it('checks the screen content, not a dock tab', () => {
        expect(source).toContain('return ROUTES[key].content;');
        // The dock selector may exist, but only as a separate milestone.
        expect(source).toMatch(/function dockSelectorFor/);
    });

    it('reports both milestones so a regression is visible', () => {
        expect(source).toContain('dockAtMs');
        expect(source).toContain('contentAtMs');
    });

    it('waits on the content marker before sampling', () => {
        const waitBlock = source.slice(source.indexOf('waitForFunction'), source.indexOf('waitForTimeout'));
        expect(waitBlock).toContain('contentSelectorFor(key)');
    });

    it('keeps the bench file where the rules doc points', () => {
        expect(relPosix(process.cwd(), path.join(process.cwd(), 'scripts/qa/route-mount-bench.mjs')))
            .toBe('scripts/qa/route-mount-bench.mjs');
    });
});
