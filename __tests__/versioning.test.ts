import fs from 'fs';
import path from 'path';

/**
 * Version guard: SemVer is only real if the two version fields and the
 * changelog agree. `package.json` and `app.json` (`expo.version`) are read by
 * different systems — npm/tests vs Expo/EAS — so they drift silently unless a
 * test compares them.
 */
const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf-8');

const SEMVER = /^\d+\.\d+\.\d+$/;

describe('versioning', () => {
    const pkg = JSON.parse(read('package.json')) as { version: string };
    const app = JSON.parse(read('app.json')) as { expo: { version: string } };

    it('keeps package.json and app.json on the same version', () => {
        expect(app.expo.version).toBe(pkg.version);
    });

    it('uses a SemVer release version', () => {
        expect(pkg.version).toMatch(SEMVER);
    });

    it('heads CHANGELOG.md with the released version in Keep a Changelog form', () => {
        const changelog = read('CHANGELOG.md');

        expect(changelog).toContain('## [Unreleased]');
        // First released heading: "## [0.1.0] - YYYY-MM-DD".
        const released = /^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})$/m.exec(changelog);
        expect(released).not.toBeNull();
        expect(released?.[1]).toBe(pkg.version);

        // Every released heading needs a matching link reference, or the
        // rendered changelog shows a dead link.
        const tags = [...changelog.matchAll(/^## \[(\d+\.\d+\.\d+)\] - /gm)].map((m) => m[1]);
        expect(tags.length).toBeGreaterThan(0);
        tags.forEach((tag) => {
            expect(changelog).toContain(`[${tag}]: `);
        });
        expect(changelog).toContain('[Unreleased]: ');
    });

    it('documents the release process in the README', () => {
        const readme = read('README.md');

        expect(readme).toContain('## Versioning and releases');
        // The three facts the section exists to state.
        expect(readme).toContain('`app.json`');
        expect(readme).toContain('vX.Y.Z');
        expect(readme).toContain('appVersionSource');
    });

    it('keeps the Android versionCode with EAS', () => {
        const eas = JSON.parse(read('eas.json')) as {
            cli?: { appVersionSource?: string };
            build?: Record<string, { autoIncrement?: boolean }>;
        };

        // `local` would make the repo's versionCode authoritative; the app has no
        // versionCode in app.json, so remote is the only source that works.
        expect(eas.cli?.appVersionSource).toBe('remote');
        expect(eas.build?.production?.autoIncrement).toBe(true);
    });
});
