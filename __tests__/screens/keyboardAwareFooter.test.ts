/**
 * Keyboard-visibility guard: the pinned chat footer ("Go deeper" / "Finish entry")
 * must stay visible while the keyboard is open.
 *
 * - Android: app.json must set softwareKeyboardLayoutMode to 'resize' so the whole
 *   layout shrinks above the keyboard (default is unreliable across devices).
 * - Both chat surfaces must wrap their layout in a KeyboardAvoidingView so iOS
 *   keeps the footer above the keyboard too.
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));

function readSource(rel: string): string {
    return fs.readFileSync(path.join(root, rel), 'utf8');
}

describe('keyboard-aware chat footer', () => {
    it('sets Android softwareKeyboardLayoutMode to resize', () => {
        expect(appJson.expo.android.softwareKeyboardLayoutMode).toBe('resize');
    });

    it('wraps the journal chat layout in a KeyboardAvoidingView', () => {
        const src = readSource('app/chat.tsx');
        expect(src).toContain('KeyboardAvoidingView');
        expect(src).toContain('behavior=');
        const jsxStart = src.indexOf('return (');
        expect(src.indexOf('<KeyboardAvoidingView')).toBeLessThan(src.indexOf('<ScrollView', jsxStart));
        // Footer must live inside the avoiding view so it rides above the keyboard.
        expect(src.indexOf('</KeyboardAvoidingView')).toBeGreaterThan(src.indexOf('<FooterActions'));
    });

    it('wraps the intentions chat layout in a KeyboardAvoidingView', () => {
        const src = readSource('app/intentions/chat.tsx');
        expect(src).toContain('KeyboardAvoidingView');
        expect(src.indexOf('<KeyboardAvoidingView')).toBeLessThan(src.indexOf('<IntentionChatBody'));
        expect(src.indexOf('</KeyboardAvoidingView')).toBeGreaterThan(src.indexOf('<IntentionChatFooter'));
    });
});
