import { Alert } from 'react-native';

/**
 * Web-safe confirmation primitive.
 *
 * `Alert.alert` is a silent no-op under react-native-web, so every destructive
 * confirmation must route through `window.confirm` on web or the action simply
 * never runs (see docs/qa/DEFECTS.md DEF-009).
 *
 * Returns:
 * - `true` / `false` on web (the user's answer).
 * - `null` when no web confirm exists — the caller keeps its `Alert.alert` path
 *   so native UX is unchanged.
 */
export function webConfirm(message: string): boolean | null {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        return window.confirm(message);
    }
    return null;
}

/**
 * Web-safe notification.
 *
 * Same reasoning as `webConfirm`: `Alert.alert` renders nothing under
 * react-native-web, which is how a failed Clear History / Restore reported
 * success-by-silence (DEF-011 / DEF-012).
 *
 * Returns `true` when the message was shown on web; `false` means the caller
 * should fall back to `Alert.alert` so native UX is unchanged.
 */
export function webNotify(title: string, message?: string): boolean {
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(message ? `${title}

${message}` : title);
        return true;
    }
    return false;
}

/**
 * Show a message the user can actually see on both platforms.
 *
 * `webNotify` returns false on native, where we keep `Alert.alert` so mobile UX
 * is unchanged. Every user-facing outcome of a destructive data action must go
 * through here - a silent failure is how DEF-011/DEF-012 stayed invisible.
 */
export function notifyUser(title: string, message?: string): void {
    if (webNotify(title, message)) {
        return;
    }
    Alert.alert(title, message ?? '');
}
