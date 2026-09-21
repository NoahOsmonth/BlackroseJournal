import React from 'react';
import { Pressable, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface SettingsAccordionSectionProps {
    readonly id: string;
    readonly title: string;
    /** One-line description of what the section holds, under the title. */
    readonly hint?: string;
    readonly summary?: string;
    /** @deprecated the concept rows carry no icon chip — kept for callers. */
    readonly icon?: keyof typeof MaterialIcons.glyphMap;
    /** Zero-based position; drives the index numeral and the band tone. */
    readonly index: number;
    readonly expanded: boolean;
    readonly onToggle: (id: string) => void;
    readonly children: React.ReactNode;
}

/**
 * One Settings row, styled as a full-bleed tonal band (design variant E).
 *
 * Rows are separated by a change of surface value instead of a hairline: even
 * bands lift to `band-*`, odd bands stay on the page background, and the open
 * band deepens to `surface-*`. That removes the ruled-table look the flat 1px
 * rule produced while keeping every row boundary obvious. The only line left is
 * a leading edge on the open band, drawn in bone.
 *
 * Row anatomy, left to right: index numeral, title over hint, then the current
 * value as a tonal pill and the chevron.
 *
 * Layout notes:
 * - Bands run edge to edge, so horizontal padding lives here rather than on the
 *   screen's ScrollView. Callers must not add their own gutter.
 * - The title column shrinks (`min-w-0`) and the value pill keeps its natural
 *   width, so at narrow widths a long *label* ellipsises rather than the value.
 *   The value is the part that changes and carries the state, so it wins the
 *   space contest; a clipped title is still recognizable.
 * - `overflow-hidden` clips the expanded body to the band's own width, which is
 *   what keeps nested swatch grids and segmented controls inside the edge.
 */
export function SettingsAccordionSection({
    id,
    title,
    hint,
    summary,
    index,
    expanded,
    onToggle,
    children,
}: SettingsAccordionSectionProps) {
    const isDark = useColorScheme() === 'dark';
    const chevronColor = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;
    const edgeColor = isDark ? BLACKROSE_PALETTE.dark.accent : BLACKROSE_PALETTE.light.accent;

    const bandTone =
        index % 2 === 0
            ? 'bg-band-light dark:bg-band-dark'
            : 'bg-background-light dark:bg-background-dark';

    return (
        <View
            testID={`settings-band-${id}`}
            className={[
                'overflow-hidden',
                expanded ? 'bg-surface-light dark:bg-surface-dark' : bandTone,
            ].join(' ')}
        >
            {/* Leading edge — the one rule this design allows. It is a *mark*,
                not a border: bone at the left gutter, fading to nothing before
                the right edge, so it never reads as a divider across the row.
                Drawn with SVG because a plain 1px View renders as a hard line
                (there is no gradient background in RN). */}
            {expanded ? (
                <View className="h-px w-full">
                    <Svg width="100%" height="1">
                        <Defs>
                            <LinearGradient id={`bandEdge-${id}`} x1="0" y1="0" x2="1" y2="0">
                                <Stop offset="0" stopColor={edgeColor} stopOpacity="0.85" />
                                <Stop offset="0.55" stopColor={edgeColor} stopOpacity="0.2" />
                                <Stop offset="0.85" stopColor={edgeColor} stopOpacity="0" />
                            </LinearGradient>
                        </Defs>
                        <Rect x="0" y="0" width="100%" height="1" fill={`url(#bandEdge-${id})`} />
                    </Svg>
                </View>
            ) : null}

            <Pressable
                onPress={() => onToggle(id)}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                accessibilityLabel={`${title}${summary ? `, ${summary}` : ''}`}
                className="min-h-[70px] flex-row items-center gap-3 px-6 py-4 active:opacity-70"
            >
                <Text
                    className="shrink-0 text-[10px] tabular-nums tracking-[1.5px] text-text-secondary-light dark:text-text-secondary-dark"
                    style={{ fontVariant: ['tabular-nums'], opacity: 0.75 }}
                >
                    {String(index + 1).padStart(2, '0')}
                </Text>

                <View testID={`settings-row-text-${id}`} className="min-w-0 flex-1">
                    <Text
                        className="text-[19px] text-text-light dark:text-text-dark"
                        style={{ fontFamily: 'PlayfairDisplayRegular' }}
                    >
                        {title}
                    </Text>
                    {hint ? (
                        <Text className="mt-0.5 text-[12px] text-text-secondary-light dark:text-text-secondary-dark">
                            {hint}
                        </Text>
                    ) : null}
                </View>

                {summary ? (
                    <Text
                        className={[
                            'shrink rounded-full px-2.5 py-1 text-[13px] text-text-secondary-light dark:text-text-secondary-dark',
                            expanded
                                ? 'bg-surface-2-light dark:bg-surface-2-dark'
                                : 'bg-black/5 dark:bg-white/10',
                        ].join(' ')}
                        numberOfLines={1}
                        style={{ fontFamily: 'PlayfairDisplayRegular' }}
                    >
                        {summary}
                    </Text>
                ) : null}

                <MaterialIcons
                    name={expanded ? 'expand-less' : 'expand-more'}
                    size={22}
                    color={chevronColor}
                />
            </Pressable>

            {expanded ? <View className="px-6 pt-1 pb-6">{children}</View> : null}
        </View>
    );
}
