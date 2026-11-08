import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useReminders } from '@/hooks/settings/useReminders';
import { describeReminderSchedule, formatTime, type ReminderTime } from '@/utils/reminders';

const HAIRLINE = 'border-hairline-light dark:border-hairline-dark';

/** The hours a writer can pick — 5am to 11pm, the part of the day this is for. */
const HOUR_CHOICES = [5, 6, 7, 8, 9, 10, 17, 18, 19, 20, 21, 22];

interface ReminderRowProps {
    readonly label: string;
    readonly detail: string;
    readonly isOn: boolean;
    readonly showBorder?: boolean;
    readonly onPress: () => void;
}

function ReminderRow({ label, detail, isOn, showBorder = true, onPress }: ReminderRowProps) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="switch"
            accessibilityState={{ checked: isOn }}
            accessibilityLabel={`${label}. ${detail}`}
            className={`min-h-[56px] flex-row items-center justify-between py-3 ${showBorder ? `border-b ${HAIRLINE}` : ''}`}
        >
            <View className="flex-1 pr-4 gap-1">
                <Text className="text-[16px] text-text-light dark:text-text-dark">{label}</Text>
                <Text className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark">{detail}</Text>
            </View>
            <Text className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                {isOn ? 'On' : 'Off'}
            </Text>
        </Pressable>
    );
}

interface TimePickerProps {
    readonly slot: 'morning' | 'evening';
    readonly value: ReminderTime;
    readonly onChange: (next: ReminderTime) => void;
}

function TimePicker({ slot, value, onChange }: TimePickerProps) {
    return (
        <View className="flex-row flex-wrap gap-2 pb-4">
            {HOUR_CHOICES.map((hour) => {
                const isSelected = value.hour === hour;
                return (
                    <Pressable
                        key={`${slot}-${hour}`}
                        onPress={() => onChange({ hour, minute: value.minute })}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        accessibilityLabel={`${slot === 'morning' ? 'Morning' : 'Evening'} at ${formatTime({ hour, minute: value.minute })}`}
                        className={`min-h-[44px] justify-center rounded-full border px-4 ${
                            isSelected
                                ? 'border-hairline-light dark:border-hairline-dark bg-bone-light dark:bg-bone-dark'
                                : `border-hairline-light dark:border-hairline-dark`
                        }`}
                    >
                        <Text className="text-[13px] text-text-light dark:text-text-dark">
                            {formatTime({ hour, minute: value.minute })}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

/** Settings > Reminders (Kaneo #9). */
export function ReminderSettingsSection() {
    const { settings, isLoading, update } = useReminders();

    return (
        <View testID="reminder-settings-section">
            <Text className="pb-3 text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                {isLoading ? 'Reading your reminder times…' : describeReminderSchedule(settings)}
            </Text>

            <ReminderRow
                label="Morning nudge"
                detail={`A gentle nudge at ${formatTime(settings.morning)}.`}
                isOn={settings.morningEnabled}
                onPress={() => void update({ morningEnabled: !settings.morningEnabled })}
            />
            {settings.morningEnabled ? (
                <TimePicker
                    slot="morning"
                    value={settings.morning}
                    onChange={(next) => void update({ morning: next })}
                />
            ) : null}

            <ReminderRow
                label="Evening nudge"
                detail={`A gentle nudge at ${formatTime(settings.evening)}.`}
                isOn={settings.eveningEnabled}
                onPress={() => void update({ eveningEnabled: !settings.eveningEnabled })}
            />
            {settings.eveningEnabled ? (
                <TimePicker
                    slot="evening"
                    value={settings.evening}
                    onChange={(next) => void update({ evening: next })}
                />
            ) : null}

            <ReminderRow
                label="Skip if I already wrote"
                detail="No nudge on days you have already written in that part of the day."
                isOn={settings.skipWhenAlreadyWritten}
                showBorder={false}
                onPress={() => void update({ skipWhenAlreadyWritten: !settings.skipWhenAlreadyWritten })}
            />
        </View>
    );
}
