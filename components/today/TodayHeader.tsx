/**
 * TodayHeader Component (deprecated)
 * Wrapper around AppHeader for backwards compatibility
 */

import { AppHeader } from '@/components/navigation';
import React from 'react';

interface TodayHeaderProps {
    /** Formatted date string, e.g., "Sunday, Jan 18th" */
    dateTitle: string;
    onLeftPress?: () => void;
    onRightPress?: () => void;
}

export function TodayHeader({ dateTitle, onLeftPress, onRightPress }: TodayHeaderProps) {
    return (
        <AppHeader
            title={dateTitle}
            variant="today"
            onLeftPress={onLeftPress}
            onRightPress={onRightPress}
        />
    );
}
