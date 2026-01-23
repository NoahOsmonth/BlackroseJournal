/**
 * JournalHeader Component (deprecated)
 * Wrapper around AppHeader for backwards compatibility
 */

import { AppHeader } from '@/components/navigation';
import React from 'react';

interface JournalHeaderProps {
    onMenuPress?: () => void;
    onGiftPress?: () => void;
}

export function JournalHeader({ onMenuPress, onGiftPress }: JournalHeaderProps) {
    return (
        <AppHeader
            title="Journal"
            variant="journal"
            onLeftPress={onGiftPress}
            onRightPress={onMenuPress}
        />
    );
}
