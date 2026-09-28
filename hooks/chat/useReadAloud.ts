import { useCallback, useEffect, useRef, useState } from 'react';
import * as Speech from 'expo-speech';

export interface UseReadAloudReturn {
    /** True while the companion's words are being spoken. */
    isSpeaking: boolean;
    /** Reads the given text, replacing anything already speaking. */
    speak: (text: string) => void;
    /** Stops immediately. Safe to call when nothing is speaking. */
    stop: () => void;
    /** Speak if idle, stop if already speaking the same text. */
    toggle: (text: string) => void;
}

/**
 * Read the companion's reply aloud.
 *
 * Deliberately manual: nothing in the transcript starts talking on its own.
 * The session's speech is cleared on stop and on unmount so a finished reply
 * can never keep playing behind another screen.
 */
export function useReadAloud(): UseReadAloudReturn {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const spokenRef = useRef<string | null>(null);

    const stop = useCallback(() => {
        spokenRef.current = null;
        setIsSpeaking(false);
        Speech.stop();
    }, []);

    const speak = useCallback((text: string) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        spokenRef.current = trimmed;
        setIsSpeaking(true);
        Speech.stop();
        Speech.speak(trimmed, {
            onDone: () => {
                if (spokenRef.current !== trimmed) return;
                spokenRef.current = null;
                setIsSpeaking(false);
            },
            onStopped: () => {
                if (spokenRef.current !== trimmed) return;
                spokenRef.current = null;
                setIsSpeaking(false);
            },
            onError: () => {
                if (spokenRef.current !== trimmed) return;
                spokenRef.current = null;
                setIsSpeaking(false);
            },
        });
    }, []);

    const toggle = useCallback((text: string) => {
        if (spokenRef.current && spokenRef.current === text.trim()) {
            stop();
            return;
        }
        speak(text);
    }, [speak, stop]);

    /**
     * A reply must not keep talking after the screen is gone. Clearing the ref
     * first also makes a late `onDone` from the engine a no-op, so the cleanup
     * never has to touch state on a component that is already unmounted.
     */
    useEffect(
        () => () => {
            spokenRef.current = null;
            Speech.stop();
        },
        []
    );

    return { isSpeaking, speak, stop, toggle };
}
