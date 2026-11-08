/**
 * The Archive's empty states, kept out of the screen so it stays under the
 * 450-line design warning. Pure rendering: the screen owns all the decisions.
 */
import React from 'react';
import { Text, View } from 'react-native';

import { DayEmptyState } from '@/components/entries/DayEmptyState';
import { HistoryEmpty } from '@/components/history/HistoryEmpty';
import type { HistorySection } from '@/hooks/history/historyUtils';

interface ArchiveEmptyStateProps {
    readonly noTagMatches: boolean;
    readonly activeTagLabel: string;
    readonly noDayMatches: boolean;
    readonly selectedDay: HistorySection | undefined;
    readonly onClearDay: () => void;
    readonly noMoodMatches: boolean;
    readonly activeMoodLabel: string;
    readonly noTopicMatches: boolean;
    readonly activeTopicLabel: string;
    readonly nothingStarred: boolean;
    readonly hasAnyItems: boolean;
    readonly isSearching: boolean;
    readonly onWritePress: () => void;
}

const HEAD = 'text-center text-[22px] text-text-light dark:text-text-dark';
const BODY = 'mt-3 text-center text-[15px] leading-[1.5] text-text-secondary-light dark:text-text-secondary-dark';
const SERIF = { fontFamily: 'PlayfairDisplayRegular' };

function PlainEmpty({
    testID, head, body,
}: { readonly testID?: string; readonly head: string; readonly body: string }) {
    return (
        <View className="items-center px-8 pt-16" testID={testID}>
            <Text className={HEAD} style={SERIF}>{head}</Text>
            <Text className={BODY}>{body}</Text>
        </View>
    );
}

export function ArchiveEmptyState(props: ArchiveEmptyStateProps) {
    if (props.noTagMatches) {
        return <PlainEmpty
            testID="archive-tag-empty"
            head={`Nothing here under ${props.activeTagLabel}`}
            body="Try another label, or show every entry."
        />;
    }
    if (props.noDayMatches) {
        return <DayEmptyState section={props.selectedDay} onClear={props.onClearDay} />;
    }
    if (props.noMoodMatches) {
        return <PlainEmpty
            testID="archive-mood-empty"
            head={`Nothing here about feeling ${props.activeMoodLabel}`}
            body="Try another feeling, or show every entry."
        />;
    }
    if (props.noTopicMatches) {
        return <PlainEmpty
            testID="archive-topic-empty"
            head={`Nothing here about ${props.activeTopicLabel}`}
            body="Try another word, or show every topic."
        />;
    }
    if (props.nothingStarred) {
        return <PlainEmpty
            head="No starred moments yet"
            body="Open an entry and tap the star to keep a moment here."
        />;
    }
    return (
        <HistoryEmpty
            hasAnyItems={props.hasAnyItems}
            isSearching={props.isSearching}
            onWritePress={props.onWritePress}
        />
    );
}
