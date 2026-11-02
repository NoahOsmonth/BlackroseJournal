/**
 * Static wiring checks for the crash-log feature: the handler must be installed
 * at import time (so a first-render crash is caught) and the viewer route must
 * be registered, or the post-crash banner navigates into nothing.
 */
import fs from 'fs';
import path from 'path';

import { relPosix } from '../mocks/repoPath';

describe('crash log wiring', () => {
    const layoutSource = fs.readFileSync(
        path.join(process.cwd(), 'app', '_layout.tsx'),
        'utf-8',
    );

    it('installs the global crash handler from the root layout', () => {
        expect(layoutSource).toMatch(
            /import\s*\{\s*installCrashHandler\s*\}\s*from\s*['"]@\/services\/crash\/crashHandler['"]/
        );
        expect(layoutSource).toMatch(/installCrashHandler\(\)/);
    });

    it('registers the crash-logs route', () => {
        expect(layoutSource).toMatch(/<Stack\.Screen\s+name="crash-logs"\s*\/>/);
    });

    it('ships the crash-logs screen file', () => {
        const routePath = path.join(process.cwd(), 'app', 'crash-logs.tsx');
        expect(fs.existsSync(routePath)).toBe(true);
        expect(relPosix(process.cwd(), routePath)).toBe('app/crash-logs.tsx');
    });

    it('reports boundary errors instead of only logging them', () => {
        const boundarySource = fs.readFileSync(
            path.join(process.cwd(), 'components', 'system', 'AppErrorBoundary.tsx'),
            'utf-8',
        );
        expect(boundarySource).toMatch(/reportBoundaryCrash\(/);
    });

    it('opens crash logs from the Settings about band', () => {
        const settingsSource = fs.readFileSync(
            path.join(process.cwd(), 'app', '(tabs)', 'settings.tsx'),
            'utf-8',
        );
        expect(settingsSource).toMatch(/onCrashLogsPress=\{\(\)\s*=>\s*router\.push\('\/crash-logs'\)\}/);
    });
});
