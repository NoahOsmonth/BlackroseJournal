import React, { useEffect, useState } from 'react';
import { Image, Pressable, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { getPersonaAvatarSource, PERSONA_VOICES, PersonaAvatarKey } from '@/constants/personas';
import { AvatarPickerModal } from './AvatarPickerModal';
import { VoicePickerModal } from './VoicePickerModal';

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
    const colorScheme = useColorScheme();
    const iconColor = colorScheme === 'dark' ? '#F9FAFB' : '#111827';

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
            <View className="flex-row items-center justify-between px-4 py-3">
                <Pressable
                    onPress={onBack}
                    className="p-2 -ml-2"
                    accessibilityLabel="Back"
                >
                    <MaterialIcons name="arrow-back" size={24} color={iconColor} />
                </Pressable>
                <Text className="text-[17px] font-semibold text-text-light dark:text-text-dark">{title}</Text>
                <Pressable
                    onPress={() => canSubmit && onSubmit(values)}
                    disabled={!canSubmit}
                    accessibilityLabel={submitLabel}
                >
                    <Text className={`text-[17px] ${canSubmit ? 'text-primary' : 'text-text-secondary-light'}`}>
                        {submitLabel}
                    </Text>
                </Pressable>
            </View>

            <View className="px-4 pb-10">
                <View className="flex items-center py-8">
                    <Pressable
                        onPress={() => setShowAvatarPicker(true)}
                        className="w-28 h-28 rounded-full bg-orange-600 overflow-hidden items-center justify-center"
                        accessibilityLabel="Edit avatar"
                    >
                        {avatarSource ? (
                            <Image
                                source={avatarSource}
                                style={{ width: 112, height: 112 }}
                            />
                        ) : (
                            <Text className="text-white text-2xl">
                                {values.name.trim().charAt(0).toUpperCase() || 'O'}
                            </Text>
                        )}
                        <View className="absolute top-0 right-0 w-8 h-8 rounded-full bg-surface-light items-center justify-center">
                            <MaterialIcons name="edit" size={16} color="#6B7280" />
                        </View>
                    </Pressable>
                </View>

                <View className="bg-surface-light dark:bg-surface-dark rounded-xl overflow-hidden shadow-soft mb-6">
                    <View className="border-b border-divider-light dark:border-divider-dark">
                        <TextInput
                            value={values.name}
                            onChangeText={(text) => updateValues((prev) => ({ ...prev, name: text }))}
                            placeholder="Name"
                            placeholderTextColor="#9CA3AF"
                            className="px-4 py-3 text-[17px] text-text-light dark:text-text-dark"
                        />
                    </View>
                    <View className="border-b border-divider-light dark:border-divider-dark">
                        <TextInput
                            value={values.tagline}
                            onChangeText={(text) => updateValues((prev) => ({ ...prev, tagline: text }))}
                            placeholder="Tagline"
                            placeholderTextColor="#9CA3AF"
                            className="px-4 py-3 text-[17px] text-text-light dark:text-text-dark"
                        />
                    </View>
                    <Pressable
                        onPress={() => setShowVoicePicker(true)}
                        className="flex-row items-center justify-between px-4 py-3"
                    >
                        <View className="flex-row items-center gap-3">
                            <MaterialIcons name="volume-up" size={20} color="#9CA3AF" />
                            <Text className="text-[17px] text-text-light dark:text-text-dark">Voice</Text>
                        </View>
                        <View className="flex-row items-center gap-1">
                            <Text className="text-[17px] text-text-secondary-light dark:text-text-secondary-dark">
                                {values.voice}
                            </Text>
                            <MaterialIcons name="chevron-right" size={20} color="#9CA3AF" />
                        </View>
                    </Pressable>
                </View>

                <View className="mb-6">
                    <Text className="text-[13px] uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark mb-2 pl-4">
                        Personalization
                    </Text>
                    <View className="bg-surface-light dark:bg-surface-dark rounded-xl p-4 shadow-soft h-48">
                        <TextInput
                            value={values.prompt}
                            onChangeText={(text) => updateValues((prev) => ({ ...prev, prompt: text }))}
                            placeholder="Describe your desired personality and response style..."
                            placeholderTextColor="#9CA3AF"
                            className="text-[17px] text-text-light dark:text-text-dark h-full"
                            multiline
                            maxLength={2000}
                        />
                        <View className="absolute bottom-4 right-4">
                            <Text className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                                {values.prompt.length} / 2000
                            </Text>
                        </View>
                    </View>
                </View>

                <View className="mb-10">
                    <Text className="text-[13px] uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark mb-2 pl-4">
                        More
                    </Text>
                    <View className="bg-surface-light dark:bg-surface-dark rounded-xl overflow-hidden shadow-soft">
                        <Pressable
                            onPress={onAdvanced}
                            className="flex-row items-center justify-between px-4 py-3"
                        >
                            <Text className="text-[17px] text-text-light dark:text-text-dark">Advanced</Text>
                            <MaterialIcons name="chevron-right" size={20} color="#9CA3AF" />
                        </Pressable>
                    </View>
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
