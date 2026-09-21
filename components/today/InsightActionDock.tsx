/**
 * Insight Action Dock
 *
 * The insight's four actions as a *state of the card* rather than a layer above
 * the app. There is no modal, no scrim and no Cancel row: the `...` glyph keeps
 * the dock in place, each action dismisses on the press that chose it, and
 * nothing is dimmed, so the rest of Today stays live.
 *
 * Replaces `InsightMoreOptionsModal`, whose sheet had a ~1/3 inert area and a
 * near-invisible scrim in dark mode, which is what made "tap outside to close"
 * a hunt for the Cancel row.
 * Source: example-design/blackrose/insight-options-variants/variant-c-action-dock.html
 */

import React from 'react';
import { Pressable, Text } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface DockAction {
    label: string;
    icon: React.ComponentProps<typeof MaterialIcons>['name'];
    onPress: () => void;
    danger?: boolean;
}

export interface InsightActionDockProps {
    onShare: () => void;
    onCopy: () => void;
    onShowSavedInsights: () => void;
    onHide: () => void;
    /** A press on the dock that is not on an action dismisses, as the card body does. */
    onDismiss: () => void;
}

/**
 * Destructive action last, where it is hardest to hit while reaching for the
 * common ones — and tinted with the danger token so it never looks like Copy.
 *
 * The container is itself pressable so the strip has no inert band of its own:
 * its padding used to be the exact class of dead space that made the old sheet
 * feel broken. The action buttons win the responder, so only the gaps dismiss.
 */
export function InsightActionDock({
    onShare,
    onCopy,
    onShowSavedInsights,
    onHide,
    onDismiss,
}: InsightActionDockProps) {
    const isDark = useColorScheme() === 'dark';
    const iconColor = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;
    const dangerColor = isDark ? BLACKROSE_PALETTE.dark.danger : BLACKROSE_PALETTE.light.danger;

    const actions: DockAction[] = [
        { label: 'Share', icon: 'share', onPress: onShare },
        { label: 'Copy', icon: 'content-copy', onPress: onCopy },
        { label: 'Saved insights', icon: 'bookmark-border', onPress: onShowSavedInsights },
        { label: 'Hide for today', icon: 'visibility-off', onPress: onHide, danger: true },
    ];

    return (
        <Pressable
            onPress={onDismiss}
            accessibilityRole="menu"
            className="flex-row items-stretch gap-1 border-t border-hairline-light bg-surface-light px-3 py-2 dark:border-hairline-dark dark:bg-surface-dark"
        >
            {actions.map((action) => (
                <Pressable
                    key={action.label}
                    onPress={action.onPress}
                    accessibilityRole="menuitem"
                    accessibilityLabel={action.label}
                    className="min-h-[56px] flex-1 items-center justify-center gap-1 rounded-control px-1 py-2 active:opacity-70"
                >
                    <MaterialIcons
                        name={action.icon}
                        size={20}
                        color={action.danger ? dangerColor : iconColor}
                    />
                    <Text
                        numberOfLines={2}
                        className={
                            action.danger
                                ? 'text-center text-[11px] leading-[14px] text-danger-light dark:text-danger-dark'
                                : 'text-center text-[11px] leading-[14px] text-text-light dark:text-text-dark'
                        }
                    >
                        {action.label}
                    </Text>
                </Pressable>
            ))}
        </Pressable>
    );
}
