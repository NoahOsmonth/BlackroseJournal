import { useEffect } from 'react';
import { Keyboard } from 'react-native';

interface ScrollToBottomOptions {
    force?: boolean;
    animated?: boolean;
}

/**
 * Keeps the writing slip and the verbs below it reachable while the keyboard is up.
 *
 * The composer bar already lives inside a `KeyboardAvoidingView`, so the bar
 * itself rides above the keyboard. What that does *not* do is move the transcript:
 * the scroll view simply gets shorter, and the slip (which sits in the flow, as
 * the last child) can end up under the keyboard. So on `keyboardDidShow` — after
 * the keyboard is fully raised and the avoiding view has applied its padding, so
 * `scrollToEnd` lands on the real, shorter viewport — the transcript is pushed to
 * its end with `force`, because tapping the slip is an explicit "I want to write".
 *
 * One listener, one scroll, no polling: the event is the signal.
 */
export function useKeyboardAwareScroll(
    scrollToBottom: (options?: ScrollToBottomOptions) => void
): void {
    useEffect(() => {
        const subscription = Keyboard.addListener('keyboardDidShow', () => {
            scrollToBottom({ force: true });
        });
        return () => subscription.remove();
    }, [scrollToBottom]);
}
