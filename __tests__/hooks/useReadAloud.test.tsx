import { act, renderHook } from '@testing-library/react-native';
import * as Speech from 'expo-speech';

import { useReadAloud } from '../../hooks/chat/useReadAloud';

jest.mock('expo-speech', () => ({
    speak: jest.fn(),
    stop: jest.fn(),
}));

const speakMock = Speech.speak as jest.MockedFunction<typeof Speech.speak>;
const stopMock = Speech.stop as jest.MockedFunction<typeof Speech.stop>;

/** The callbacks the hook handed to the speech engine for the most recent utterance. */
function lastSpeechOptions(): Speech.SpeechOptions {
    const calls = speakMock.mock.calls;
    return calls[calls.length - 1][1] as Speech.SpeechOptions;
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe('useReadAloud', () => {
    it('speaks the trimmed reply and reports that it is speaking', () => {
        const { result } = renderHook(() => useReadAloud());

        act(() => result.current.speak('  Good. I will leave it there.  '));

        expect(speakMock).toHaveBeenCalledWith('Good. I will leave it there.', expect.any(Object));
        expect(result.current.isSpeaking).toBe(true);
    });

    it('stays silent for empty text', () => {
        const { result } = renderHook(() => useReadAloud());

        act(() => result.current.speak('   '));

        expect(speakMock).not.toHaveBeenCalled();
        expect(result.current.isSpeaking).toBe(false);
    });

    it('stops the previous utterance before starting a new one', () => {
        const { result } = renderHook(() => useReadAloud());

        act(() => result.current.speak('first'));
        act(() => result.current.speak('second'));

        expect(stopMock).toHaveBeenCalledTimes(2);
        expect(speakMock).toHaveBeenLastCalledWith('second', expect.any(Object));
    });

    it('clears the speaking state when the engine reports it finished', () => {
        const { result } = renderHook(() => useReadAloud());

        act(() => result.current.speak('a reply'));
        act(() => lastSpeechOptions().onDone?.());

        expect(result.current.isSpeaking).toBe(false);
    });

    it('clears the speaking state when the engine reports an error', () => {
        const { result } = renderHook(() => useReadAloud());

        act(() => result.current.speak('a reply'));
        act(() => lastSpeechOptions().onError?.(new Error('no voice installed')));

        expect(result.current.isSpeaking).toBe(false);
    });

    it('ignores a late completion from a reply that was replaced', () => {
        const { result } = renderHook(() => useReadAloud());

        act(() => result.current.speak('first'));
        const staleOptions = lastSpeechOptions();

        act(() => result.current.speak('second'));
        // The first utterance finishing must not silence the one now playing.
        act(() => staleOptions.onDone?.());

        expect(result.current.isSpeaking).toBe(true);
    });

    it('toggles off when asked to read the same reply that is already speaking', () => {
        const { result } = renderHook(() => useReadAloud());

        act(() => result.current.toggle('a reply'));
        expect(result.current.isSpeaking).toBe(true);

        act(() => result.current.toggle('a reply'));

        expect(result.current.isSpeaking).toBe(false);
        expect(stopMock).toHaveBeenCalledTimes(2); // once to replace, once to stop
        expect(speakMock).toHaveBeenCalledTimes(1);
    });

    it('toggles onto a different reply instead of stopping', () => {
        const { result } = renderHook(() => useReadAloud());

        act(() => result.current.toggle('first'));
        act(() => result.current.toggle('second'));

        expect(result.current.isSpeaking).toBe(true);
        expect(speakMock).toHaveBeenLastCalledWith('second', expect.any(Object));
    });

    it('stops immediately when asked, even with nothing speaking', () => {
        const { result } = renderHook(() => useReadAloud());

        act(() => result.current.stop());

        expect(stopMock).toHaveBeenCalled();
        expect(result.current.isSpeaking).toBe(false);
    });

    it('stops talking when the screen goes away', () => {
        const { result, unmount } = renderHook(() => useReadAloud());

        act(() => result.current.speak('a reply that should not follow you'));
        stopMock.mockClear();

        unmount();

        expect(stopMock).toHaveBeenCalled();
    });

    it('ignores a completion that arrives after the screen is gone', () => {
        const { result, unmount } = renderHook(() => useReadAloud());

        act(() => result.current.speak('a reply'));
        const pendingOptions = lastSpeechOptions();

        unmount();

        // Would throw "update on an unmounted component" if the hook still held the utterance.
        expect(() => pendingOptions.onDone?.()).not.toThrow();
    });
});
