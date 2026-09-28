import { renderHook } from '@testing-library/react-native';
import { Keyboard } from 'react-native';

import { useKeyboardAwareScroll } from '../../hooks/chat/useKeyboardAwareScroll';

describe('useKeyboardAwareScroll', () => {
    it('pulls the transcript to its end once the keyboard is up', () => {
        const handlers: Record<string, () => void> = {};
        const remove = jest.fn();
        const spy = jest.spyOn(Keyboard, 'addListener').mockImplementation(((
            event: string,
            handler: () => void
        ) => {
            handlers[event] = handler;
            return { remove };
        }) as unknown as typeof Keyboard.addListener);

        const scrollToBottom = jest.fn();
        const { unmount } = renderHook(() => useKeyboardAwareScroll(scrollToBottom));

        // `keyboardDidShow`, not `keyboardWillShow`: the scroll has to land after the
        // avoiding view has applied its padding, or it lands on the taller viewport.
        expect(spy).toHaveBeenCalledWith('keyboardDidShow', expect.any(Function));
        expect(handlers.keyboardDidShow).toBeDefined();

        handlers.keyboardDidShow();
        expect(scrollToBottom).toHaveBeenCalledWith({ force: true });

        unmount();
        expect(remove).toHaveBeenCalledTimes(1);

        spy.mockRestore();
    });
});
