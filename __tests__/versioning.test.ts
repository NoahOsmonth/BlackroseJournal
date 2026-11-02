import fs from 'fs';
import path from 'path';

/**
 * Version guard: SemVer is only real if the two version fields and the
 * changelog agree. `package.json` and `app.json` (`expo.version`) are read by
 * different systems — npm/tests vs Expo/EAS — so they drift silently unless a
 * test compares them.
 */
const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf-8');

/**
 * SemVer 2.0.0 numeric identifiers forbid leading zeros: `01.2.3` is not a
 * version. A looser `\d+\.\d+\.\d+` would bless it, so each component is
 * either a bare `0` or a non-zero digit followed by digits.
 */
const SEMVER = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;

/** A Markdown link reference definition: `[label]: destination`. */
const LINK_DEFINITION = /^\[([^\]]+)\]:[ \t]*(\S+)[ \t]*$/gm;

function linkDefinitions(markdown: string): Map<string, string> {
    return new Map(
        [...markdown.matchAll(LINK_DEFINITION)].map((m) => [m[1], m[2]])
    );
}

describe('versioning', () => {
    const pkg = JSON.parse(read('package.json')) as { version: string };
    const app = JSON.parse(read('app.json')) as { expo: { version: string } };

    it('keeps package.json and app.json on the same version', () => {
        expect(app.expo.version).toBe(pkg.version);
    });

    it('uses a SemVer release version', () => {
        expect(pkg.version).toMatch(SEMVER);
    });

    it('keeps the appInfo fallback literal in sync', () => {
        // `constants/appInfo.ts` falls back to a literal when a runtime exposes
        // no expo config at all. That literal is a third copy of the version, so
        // it needs its own guard or the About label drifts after a bump.
        const source = read('constants/appInfo.ts');
        const fallback = /\?\?\s*'([^']+)'\s*;/.exec(source);
        expect(fallback?.[1]).toBe(pkg.version);
    });

    it('heads CHANGELOG.md with the released version in Keep a Changelog form', () => {
        const changelog = read('CHANGELOG.md');

        expect(changelog).toContain('## [Unreleased]');
        // First released heading: "## [0.1.0] - YYYY-MM-DD".
        const released = /^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})$/m.exec(changelog);
        expect(released).not.toBeNull();
        expect(released?.[1]).toBe(pkg.version);

        // Every released heading needs a real link reference definition. Matching
        // the substring `[0.1.0]: ` is not enough — a malformed or empty
        // destination would pass that and still render a dead link.
        const refs = linkDefinitions(changelog);
        const tags = [...changelog.matchAll(/^## \[(\d+\.\d+\.\d+)\] - /gm)].map((m) => m[1]);
        expect(tags.length).toBeGreaterThan(0);

        [...tags, 'Unreleased'].forEach((label) => {
            const destination = refs.get(label);
            expect(destination).toBeDefined();
            expect(destination).toMatch(/^https?:\/\/\S+$/);
        });
    });

    it('documents the release process in the README', () => {
        const readme = read('README.md');

        expect(readme).toContain('## Versioning and releases');
        // The facts the section exists to state.
        expect(readme).toContain('`app.json`');
        expect(readme).toContain('vX.Y.Z');
        expect(readme).toContain('appVersionSource');
        // A tag pushed from an unmerged branch publishes a release whose code
        // never reaches the default branch.
        expect(readme).toMatch(/merge[^\n]*`main`[^\n]*before tagging/i);
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
