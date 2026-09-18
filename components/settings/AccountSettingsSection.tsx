import React from 'react';
import { Text } from 'react-native';

import { SettingsSection } from './SettingsSection';

interface AccountSettingsSectionProps {
    readonly embedded?: boolean;
}

const BODY = 'text-[15px] leading-6 text-text-secondary-light dark:text-text-secondary-dark';

/**
 * Account body for the local-only build: there is no sign-in, no remote
 * account and no sync, so the section documents where the data lives instead
 * of offering sign-in/sign-out actions that no longer exist.
 */
export function AccountSettingsSection({
    embedded = false,
}: AccountSettingsSectionProps) {
    return (
        <SettingsSection title="Account" embedded={embedded}>
            <Text className="text-[16px] text-text-light dark:text-text-dark">
                This device
            </Text>
            <Text className={`mt-2 ${BODY}`}>
                Your journal, memories and identity live only on this device. There is no
                account to sign in to and nothing is uploaded, so clearing your browser or
                app data is permanent — keep a backup from Data Management.
            </Text>
        </SettingsSection>
    );
}
