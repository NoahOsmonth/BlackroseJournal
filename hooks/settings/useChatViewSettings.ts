import { useCallback, useEffect, useRef, useState } from 'react';

import {
    ChatViewSettings,
    DEFAULT_CHAT_VIEW_SETTINGS,
    loadChatViewSettings,
    saveChatViewSettings,
} from '@/services/ai/chatViewSettings';

export interface UseChatViewSettingsReturn {
    /** False while the stored preference is still loading. */
    isLoading: boolean;
    showThinking: boolean;
    setShowThinking: (next: boolean) => Promise<void>;
    toggleShowThinking: () => Promise<void>;
}

/**
 * Persisted "show thinking" preference, shared by both chat surfaces.
 * The in-memory value flips immediately so the toggle never feels laggy;
 * the write is serialized so rapid taps cannot clobber each other.
 */
export function useChatViewSettings(): UseChatViewSettingsReturn {
    const [settings, setSettings] = useState<ChatViewSettings>(DEFAULT_CHAT_VIEW_SETTINGS);
    const [isLoading, setIsLoading] = useState(true);
    const settingsRef = useRef(settings);
    settingsRef.current = settings;
    const saveQueue = useRef(Promise.resolve());

    useEffect(() => {
        let mounted = true;
        loadChatViewSettings()
            .then((loaded) => {
                if (!mounted) return;
                settingsRef.current = loaded;
                setSettings(loaded);
            })
            .finally(() => {
                if (mounted) setIsLoading(false);
            });
        return () => {
            mounted = false;
        };
    }, []);

    const setShowThinking = useCallback(async (next: boolean) => {
        const optimistic = { ...settingsRef.current, showThinking: next };
        settingsRef.current = optimistic;
        setSettings(optimistic);
        const run = saveQueue.current.then(() => saveChatViewSettings({ showThinking: next }));
        saveQueue.current = run.then(() => undefined, () => undefined);
        await run;
    }, []);

    const toggleShowThinking = useCallback(
        () => setShowThinking(!settingsRef.current.showThinking),
        [setShowThinking]
    );

    return {
        isLoading,
        showThinking: settings.showThinking,
        setShowThinking,
        toggleShowThinking,
    };
}
