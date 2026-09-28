/**
 * Bottom-sheet keyboard contract.
 *
 * Incident: the app's action sheets are bottom-anchored (`flex-1 justify-end`)
 * inside a transparent `Modal`. On Android 15+ / targetSdk 35+ the platform
 * enforces edge-to-edge, so `android:windowSoftInputMode="adjustResize"` no longer
 * resizes the window and nothing lifts the sheet. The soft keyboard therefore
 * covered the sheet's own controls — the entry editor's text field and its
 * Cancel/Save row, and the goal sheet's input on top of an `autoFocus` that opens
 * the keyboard the moment the sheet appears.
 *
 * The fix is to make the sheet's backdrop a KeyboardAvoidingView with a concrete
 * behavior, so the bottom-anchored content rides above the IME.
 *
 * This is a source contract, not a layout test: react-native-testing-library
 * renders the tree without layout and cannot see "covered by the keyboard".
 */
import fs from 'fs';
import path from 'path';

import { relPosix } from '../mocks/repoPath';

const root = path.resolve(__dirname, '../..');

/** Every .tsx under the given dirs, excluding tests and node_modules. */
function walk(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, out);
        else if (entry.name.endsWith('.tsx')) out.push(full);
    }
    return out;
}

const files = [
    ...walk(path.join(root, 'app')),
    ...walk(path.join(root, 'components')),
];

/** The backdrop line of a bottom-anchored modal sheet. */
const SHEET_BACKDROP = /className="flex-1 justify-end bg-black\/50"/;

const sheets = files
    // Normalize to POSIX separators so the expectations below are platform-stable
    // (path.relative yields backslashes on Windows).
    .map((file) => ({
        file: relPosix(root, file),
        src: fs.readFileSync(file, 'utf8'),
    }))
    .filter(({ src }) => SHEET_BACKDROP.test(src));

describe('bottom-sheet keyboard handling', () => {
    it('finds the app bottom sheets (guard against the scan silently matching nothing)', () => {
        expect(sheets.map((s) => s.file).sort()).toEqual([
            'components/entries/EntryEditModal.tsx',
            'components/goals/GoalEditModal.tsx',
            'components/goals/GoalQuickAddModal.tsx',
            'components/intentions/FeedbackCommentModal.tsx',
        ]);
    });

    it.each(sheets.map((s) => s.file))('%s rides above the keyboard', (rel) => {
        const src = sheets.find((s) => s.file === rel)!.src;
        const line = src.split('\n').find((l) => SHEET_BACKDROP.test(l))!;
        expect(line).toContain('<KeyboardAvoidingView');
        expect(line).toContain('behavior="padding"');
        // A bare View here is the bug: the sheet stays put and the IME covers it.
        expect(line).not.toMatch(/<View[\s>]/);
    });

    it.each(sheets.map((s) => s.file))('%s keeps its sheet content inside the avoiding view', (rel) => {
        const src = sheets.find((s) => s.file === rel)!.src;
        const open = src.indexOf('<KeyboardAvoidingView');
        const close = src.indexOf('</KeyboardAvoidingView>');
        expect(open).toBeGreaterThan(-1);
        expect(close).toBeGreaterThan(open);
        // The sheet body (rounded-t-sheet) and any modal verb must sit between them.
        for (const needle of ['rounded-t-sheet', '<TextInput']) {
            if (!src.includes(needle)) continue;
            const at = src.indexOf(needle);
            expect(`${rel}:${needle}`).toBeTruthy();
            expect(at).toBeGreaterThan(open);
            expect(at).toBeLessThan(close);
        }
    });
});
