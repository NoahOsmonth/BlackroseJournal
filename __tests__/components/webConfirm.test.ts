/**
 * DEF-009 guard: `Alert.alert` is a silent no-op under react-native-web, so
 * destructive confirmations must route through `window.confirm` on web.
 * `webConfirm` returns null when no web confirm exists, which tells the caller
 * to keep its native `Alert.alert` path.
 */

import { webConfirm } from '../../components/ui/webConfirm';

describe('webConfirm', () => {
    const host = globalThis as unknown as { window?: unknown };
    const originalWindow = host.window;

    afterEach(() => {
        host.window = originalWindow;
    });

    it('returns true when the user confirms on web', () => {
        host.window = { confirm: jest.fn(() => true) };

        expect(webConfirm('Delete everything?')).toBe(true);
    });

    it('returns false when the user cancels on web', () => {
        host.window = { confirm: jest.fn(() => false) };

        expect(webConfirm('Delete everything?')).toBe(false);
    });

    it('passes the message through to window.confirm', () => {
        const confirm = jest.fn(() => true);
        host.window = { confirm };

        webConfirm('Clear local memory?');

        expect(confirm).toHaveBeenCalledWith('Clear local memory?');
    });

    it('returns null when window.confirm is unavailable (native)', () => {
        host.window = undefined;

        expect(webConfirm('Delete everything?')).toBeNull();
    });

    it('returns null when window exists without confirm', () => {
        host.window = {};

        expect(webConfirm('Delete everything?')).toBeNull();
    });
});
