import React, { useEffect, useState } from 'react';
import { Image, Pressable, Text, TextInput, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { getPersonaAvatarSource, PERSONA_VOICES, PersonaAvatarKey } from '@/constants/personas';
import { AvatarPickerModal } from './AvatarPickerModal';
import { VoicePickerModal } from './VoicePickerModal';
import { StaggerEntranceItem } from '@/components/ui/StaggerEntrance';
import { RoseMark } from '@/components/ui/RoseMark';
import { BLACKROSE_PALETTE } from '@/constants/theme';

const SERIF = { fontFamily: 'PlayfairDisplayRegular' };

export interface PersonaFormValues {
    name: string;
    tagline: string;
    voice: string;
    prompt: string;
    model: string;
    imagination: number;
    avatarKey?: PersonaAvatarKey;
}

interface PersonaFormProps {
    title: string;
    submitLabel: string;
    initialValues: PersonaFormValues;
    onBack: () => void;
    onSubmit: (values: PersonaFormValues) => void;
    onAdvanced: () => void;
    onChange?: (values: PersonaFormValues) => void;
}

const VOICE_OPTIONS = [...PERSONA_VOICES];

export function PersonaForm({
    title,
    submitLabel,
    initialValues,
    onBack,
    onSubmit,
    onAdvanced,
    onChange,
}: PersonaFormProps) {
    const [values, setValues] = useState<PersonaFormValues>(initialValues);
    const [showAvatarPicker, setShowAvatarPicker] = useState(false);
    const [showVoicePicker, setShowVoicePicker] = useState(false);
    const isDark = useColorScheme() === 'dark';
    const inkColor = isDark ? BLACKROSE_PALETTE.dark.text : BLACKROSE_PALETTE.light.text;
    const mutedColor = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;
    const accentColor = isDark ? BLACKROSE_PALETTE.dark.accent : BLACKROSE_PALETTE.light.accent;

    useEffect(() => {
        setValues(initialValues);
        onChange?.(initialValues);
    }, [initialValues, onChange]);

    const updateValues = (updater: (prev: PersonaFormValues) => PersonaFormValues) => {
        setValues((prev) => {
            const next = updater(prev);
            onChange?.(next);
            return next;
        });
    };

    const avatarSource = getPersonaAvatarSource(values.avatarKey);

    const canSubmit = values.name.trim().length > 0;

    return (
        <View className="flex-1 bg-background-light dark:bg-background-dark">
            <View className="min-h-[56px] flex-row items-center justify-between px-4 py-2">
                <Pressable
                    onPress={onBack}
                    className="h-11 w-11 items-center justify-center"
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                >
                    <MaterialIcons name="arrow-back" size={26} color={inkColor} />
                </Pressable>
                <Text
                    className="flex-1 text-center text-[26px] text-text-light dark:text-text-dark"
                    style={SERIF}
                >
                    {title}
                </Text>
                <Pressable
                    onPress={() => canSubmit && onSubmit(values)}
                    disabled={!canSubmit}
                    accessibilityRole="button"
                    accessibilityLabel={submitLabel}
                    className="min-h-11 justify-center px-2"
                >
                    <Text
                        className={`text-[17px] ${
                            canSubmit
                                ? 'text-text-light underline dark:text-text-dark'
                                : 'text-text-secondary-light dark:text-text-secondary-dark'
                        }`}
                    >
                        {submitLabel}
                    </Text>
                </Pressable>
            </View>

            <View className="px-4 pb-10">
                <View className="flex items-center py-6">
                    <Pressable
                        onPress={() => setShowAvatarPicker(true)}
                        className="h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-hairline-light bg-surface-light dark:border-hairline-dark dark:bg-surface-dark"
                        accessibilityRole="button"
                        accessibilityLabel="Edit avatar"
                    >
                        {avatarSource ? (
                            <Image
                                source={avatarSource}
                                style={{ width: 112, height: 112 }}
                            />
                        ) : (
                            <RoseMark size={56} color={accentColor} strokeWidth={1.2} />
                        )}
                        <View className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border border-hairline-light bg-surface-light dark:border-hairline-dark dark:bg-surface-dark">
                            <MaterialIcons name="edit" size={16} color={mutedColor} />
                        </View>
                    </Pressable>
                </View>

                <StaggerEntranceItem index={0} columns={1} totalItems={3} staggerType="linear" baseDelayMs={20} delayFactorMs={50} className="w-full">
                    <View className="border-t border-hairline-light dark:border-hairline-dark">
                        <TextInput
                            value={values.name}
                            onChangeText={(text) => updateValues((prev) => ({ ...prev, name: text }))}
                            placeholder="Name"
                            placeholderTextColor={mutedColor}
                            accessibilityLabel="Name"
                            className="min-h-14 px-1 py-3 text-[19px] text-text-light dark:text-text-dark"
                        />
                    </View>
                    <View className="border-t border-hairline-light dark:border-hairline-dark">
                        <TextInput
                            value={values.tagline}
                            onChangeText={(text) => updateValues((prev) => ({ ...prev, tagline: text }))}
                            placeholder="Tagline"
                            placeholderTextColor={mutedColor}
                            accessibilityLabel="Tagline"
                            className="min-h-14 px-1 py-3 text-[19px] text-text-light dark:text-text-dark"
                        />
                    </View>
                    <Pressable
                        onPress={() => setShowVoicePicker(true)}
                        accessibilityRole="button"
                        accessibilityLabel="Voice"
                        className="min-h-14 flex-row items-center justify-between border-t border-hairline-light px-1 py-3 dark:border-hairline-dark"
                    >
                        <Text className="text-[19px] text-text-light dark:text-text-dark">Voice</Text>
                        <View className="flex-row items-center gap-1.5">
                            <Text className="text-[17px] text-text-secondary-light dark:text-text-secondary-dark">
                                {values.voice}
                            </Text>
                            <MaterialIcons name="chevron-right" size={22} color={mutedColor} />
                        </View>
                    </Pressable>
                </StaggerEntranceItem>

                <View className="mt-6">
                    <Text className="mb-2 text-[19px] text-text-light dark:text-text-dark" style={SERIF}>
                        Personalization
                    </Text>
                    <View className="h-48 rounded-card border border-hairline-light p-4 dark:border-hairline-dark">
                        <TextInput
                            value={values.prompt}
                            onChangeText={(text) => updateValues((prev) => ({ ...prev, prompt: text }))}
                            placeholder="Describe your preferred tone..."
                            placeholderTextColor={mutedColor}
                            accessibilityLabel="Personalization"
                            className="h-full text-[16px] text-text-light dark:text-text-dark"
                            multiline
                            maxLength={2000}
                        />
                        <View className="absolute bottom-4 right-4">
                            <Text className="text-[14px] text-text-secondary-light dark:text-text-secondary-dark">
                                {values.prompt.length} / 2000
                            </Text>
                        </View>
                    </View>
                </View>

                <View className="mb-10 mt-6">
                    <Pressable
                        onPress={onAdvanced}
                        accessibilityRole="button"
                        accessibilityLabel="Advanced"
                        className="min-h-14 flex-row items-center justify-between border-t border-hairline-light px-1 py-3 dark:border-hairline-dark"
                    >
                        <Text className="text-[19px] text-text-light dark:text-text-dark">Advanced</Text>
                        <MaterialIcons name="chevron-right" size={22} color={mutedColor} />
                    </Pressable>
                </View>
            </View>

            <AvatarPickerModal
                visible={showAvatarPicker}
                selectedId={values.avatarKey}
                onClose={() => setShowAvatarPicker(false)}
                onSelect={(avatarKey) => {
                    updateValues((prev) => ({ ...prev, avatarKey }));
                    setShowAvatarPicker(false);
                }}
            />

            <VoicePickerModal
                visible={showVoicePicker}
                options={VOICE_OPTIONS}
                selected={values.voice}
                onClose={() => setShowVoicePicker(false)}
                onSelect={(voice) => {
                    updateValues((prev) => ({ ...prev, voice }));
                    setShowVoicePicker(false);
                }}
            />
        </View>
    );
}
