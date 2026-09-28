import path from 'path';

/**
 * Repo-relative path with POSIX separators.
 *
 * `path.relative()` returns backslashes on Windows, so comparing its output to a
 * forward-slash literal is green on Linux and red on Windows — which is exactly
 * how `__tests__/components/bottomSheetKeyboard.test.ts` shipped a Windows-only
 * failure while passing here. Every repo-relative path in a test goes through
 * this helper, and `__tests__/crossPlatformGuards.test.ts` enforces that no test
 * calls `path.relative` directly.
 *
 * On Linux `path.sep` is `/`, so this is a no-op there.
 */
export function relPosix(root: string, file: string): string {
    return path.relative(root, file).split(path.sep).join('/');
}
