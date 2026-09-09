import { useFinishBackgroundStatus } from '@/hooks/journal/useFinishBackgroundStatus';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

const AUTO_HIDE_MS = 4000;

/**
 * Thin status bar shown under headers while finish side effects (analysis,
 * memory atoms, day digest, identity, session digest, Hindsight) run in the
 * background after Finish. Auto-hides a few seconds after the run settles.
 */
export function FinishBackgroundBanner() {
    const { status, isRunning, isDone } = useFinishBackgroundStatus();
    const [visible, setVisible] = useState(false);
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (status) {
            setVisible(true);
        }
    }, [status]);

    useEffect(() => {
        if (isDone) {
            if (hideTimer.current) clearTimeout(hideTimer.current);
            hideTimer.current = setTimeout(() => setVisible(false), AUTO_HIDE_MS);
        }
        return () => {
            if (hideTimer.current) clearTimeout(hideTimer.current);
        };
    }, [isDone]);

    if (!visible || !status) return null;

    const running = isRunning && !isDone;

    return (
        <View
            accessibilityRole="alert"
            accessibilityLabel={running ? 'Updating memories' : 'Memories updated'}
            className={[
                'flex-row items-center gap-3 mx-4 mb-3 px-3 py-2.5 rounded-xl',
                running
                    ? 'bg-status-running-bg-light dark:bg-status-running-bg-dark'
                    : 'bg-status-done-bg-light dark:bg-status-done-bg-dark',
            ].join(' ')}
        >
            <View
                className={[
                    'w-2 h-2 rounded-full',
                    running ? 'bg-status-running-dot' : 'bg-status-done-dot',
                ].join(' ')}
            />
            <Text
                className={[
                    'text-[13px] font-medium',
                    running
                        ? 'text-status-running-text-light dark:text-status-running-text-dark'
                        : 'text-status-done-text-light dark:text-status-done-text-dark',
                ].join(' ')}
            >
                {running
                    ? 'Updating memories… analysis and digests running'
                    : 'Memories updated just now'}
            </Text>
        </View>
    );
}