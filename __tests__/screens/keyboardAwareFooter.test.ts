/**
 * Keyboard-visibility guard: the pinned chat footer ("Go deeper" / "Finish entry")
 * must stay visible while the keyboard is open.
 *
 * History: this suite used to assert only that the string `behavior=` appeared in
 * the source. That passed while Android shipped `behavior={undefined}`, so the
 * composer sat *behind* the soft keyboard on device — the test gave false
 * confidence. On Android 15+ / targetSdk 35+ the platform enforces edge-to-edge,
 * `android:windowSoftInputMode="adjustResize"` no longer resizes the window, and
 * the KeyboardAvoidingView is the only thing lifting the footer. So the assertion
 * that matters is the VALUE of `behavior`, not its presence.
 *
 * What is actually checked here:
 * - Android keyboard layout mode stays 'resize' (still correct, just no longer sufficient).
 * - Every KeyboardAvoidingView passes a real behavior on BOTH platforms — never
 *   `undefined`, and never an iOS-only ternary that degrades to `undefined` on Android.
 * - The footer/composer still live inside the avoiding view.
 *
 * This is a source contract, not a device test. The on-device counterpart is the
 * manual check in docs/qa: focus the composer, then confirm the send control is
 * tappable with the keyboard raised.
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));

function readSource(rel: string): string {
    return fs.readFileSync(path.join(root, rel), 'utf8');
}

/** Every KeyboardAvoidingView must declare a concrete behavior, on every platform. */
function expectConcreteBehavior(src: string, rel: string) {
    const openings = src.match(/<KeyboardAvoidingView[\s\S]{0,200}?>/g) ?? [];
    expect(openings.length).toBeGreaterThan(0);

    for (const opening of openings) {
        expect(`${rel}: ${opening}`).toContain('behavior=');
        // A Platform ternary here is the bug: on Android it resolved to `undefined`,
        // which is what let the keyboard cover the composer.
        expect(opening).not.toContain('Platform.OS');
        expect(opening).not.toContain('undefined');
        // Only the two behaviors that actually lift content are allowed.
        const behavior = opening.match(/behavior=(?:"([^"]+)"|\{([^}]+)\})/);
        const value = behavior?.[1] ?? behavior?.[2] ?? '';
        expect(['padding', 'height', 'position']).toContain(value.trim());
    }
}

describe('keyboard-aware chat footer', () => {
    it('sets Android softwareKeyboardLayoutMode to resize', () => {
        expect(appJson.expo.android.softwareKeyboardLayoutMode).toBe('resize');
    });

    it('gives the journal chat a behavior that works on Android, not just iOS', () => {
        const src = readSource('app/chat.tsx');
        expectConcreteBehavior(src, 'app/chat.tsx');
        const jsxStart = src.indexOf('return (');
        expect(src.indexOf('<KeyboardAvoidingView')).toBeLessThan(src.indexOf('<ScrollView', jsxStart));
        // Footer must live inside the avoiding view so it rides above the keyboard.
        expect(src.indexOf('</KeyboardAvoidingView')).toBeGreaterThan(src.indexOf('<FooterActions'));
    });

    it('gives the intentions chat a behavior that works on Android, not just iOS', () => {
        const src = readSource('app/intentions/chat.tsx');
        expectConcreteBehavior(src, 'app/intentions/chat.tsx');
        expect(src.indexOf('<KeyboardAvoidingView')).toBeLessThan(src.indexOf('<IntentionChatBody'));
        expect(src.indexOf('</KeyboardAvoidingView')).toBeGreaterThan(src.indexOf('<IntentionChatFooter'));
    });

    it('covers the remaining keyboard-bearing surface (ask-rosebud)', () => {
        expectConcreteBehavior(readSource('app/ask-rosebud.tsx'), 'app/ask-rosebud.tsx');
    });
});
