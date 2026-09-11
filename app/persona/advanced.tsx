import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getPersona, updatePersona } from '@/services/personas/personasStorage';
import { PersonaAdvancedSkeleton } from '@/components/personas/PersonaAdvancedSkeleton';
import {
    loadPersonaDraftSettings,
    savePersonaDraftSettings,
} from '@/services/personas/personaDraftSettings';
import { ImaginationSlider } from '@/components/personas/ImaginationSlider';
import { ModelPickerModal } from '@/components/personas/ModelPickerModal';
import {
    PERSONA_MODELS,
    PERSONA_MODEL_LABELS as MODEL_LABELS,
    PERSONA_MODEL_OPTIONS as MODEL_OPTIONS,
    PersonaModelId,
    resolvePersonaModel as resolveModel,
} from '@/constants/aiModels';

const SERIF = { fontFamily: 'PlayfairDisplayRegular' };

function getImaginationLabel(value: number): string {
    if (value <= 33) return 'Consistent';
    if (value <= 66) return 'Balanced';
    return 'Creative';
}

export default function PersonaAdvancedScreen() {
    const router = useRouter();
    const isDark = useColorScheme() === 'dark';
    const inkColor = isDark ? BLACKROSE_PALETTE.dark.text : BLACKROSE_PALETTE.light.text;
    const mutedColor = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;
    const params = useLocalSearchParams<{ personaId?: string }>();
    const personaId = Array.isArray(params.personaId) ? params.personaId[0] : params.personaId;

    const [model, setModel] = useState<PersonaModelId>(PERSONA_MODELS[0]);
    const [imagination, setImagination] = useState(25);
    const [showModelPicker, setShowModelPicker] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isActive = true;
        const load = async () => {
            if (personaId) {
                const persona = await getPersona(personaId);
                setIsLoading(false);
                if (!isActive || !persona) return;
                setModel(resolveModel(persona.model));
                setImagination(persona.imagination ?? 25);
                return;
            }
            const draft = await loadPersonaDraftSettings();
            setIsLoading(false);
            if (!isActive || !draft) return;
            setModel(resolveModel(draft.model));
            setImagination(draft.imagination);
        };
        load();
        return () => {
            isActive = false;
        };
    }, [personaId]);

    useEffect(() => {
        const persist = async () => {
            if (personaId) {
                await updatePersona(personaId, { model, imagination });
            } else {
                await savePersonaDraftSettings({ model, imagination });
            }
        };
        persist();
    }, [imagination, model, personaId]);

    const handleBack = () => {
        router.back();
    };

    const handleSelectModel = (nextModel: PersonaModelId) => {
        setModel(nextModel);
        setShowModelPicker(false);
    };

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="min-h-[56px] flex-row items-center px-4 py-2">
                <Pressable
                    onPress={handleBack}
                    className="h-11 w-11 items-center justify-center"
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                >
                    <MaterialIcons name="arrow-back" size={26} color={inkColor} />
                </Pressable>
                <Text
                    className="ml-1 flex-1 text-center text-[26px] text-text-light dark:text-text-dark"
                    style={SERIF}
                >
                    Advanced
                </Text>
                <View className="w-11" />
            </View>
            <View className="h-px bg-hairline-light dark:bg-hairline-dark" />

            <View className="flex-1 max-w-md mx-auto px-5 py-6">
                {isLoading ? (
                    <PersonaAdvancedSkeleton />
                ) : (
                <>
                <Pressable
                    onPress={() => setShowModelPicker(true)}
                    accessibilityRole="button"
                    accessibilityLabel="AI model"
                    className="min-h-14 flex-row items-center justify-between border-t border-hairline-light px-1 py-3 dark:border-hairline-dark"
                >
                    <Text className="text-[19px] text-text-light dark:text-text-dark">AI model</Text>
                    <View className="flex-row items-center gap-1.5">
                        <Text className="text-[17px] text-text-secondary-light dark:text-text-secondary-dark">
                            {MODEL_LABELS[model]}
                        </Text>
                        <MaterialIcons name="chevron-right" size={22} color={mutedColor} />
                    </View>
                </Pressable>

                <View className="border-t border-hairline-light px-1 pt-4 dark:border-hairline-dark">
                    <View className="mb-4 flex-row items-center justify-between">
                        <Text className="text-[19px] text-text-light dark:text-text-dark">
                            Imagination
                        </Text>
                        <Text className="text-[17px] text-text-secondary-light dark:text-text-secondary-dark">
                            {getImaginationLabel(imagination)}
                        </Text>
                    </View>
                    <ImaginationSlider
                        value={imagination}
                        onChange={setImagination}
                    />
                    <Text className="mt-4 text-[14px] leading-[21px] text-text-secondary-light dark:text-text-secondary-dark">
                        Lower imagination yields consistent responses. Higher sparks variety.
                    </Text>
                </View>
                </>
                )}
            </View>
            <ModelPickerModal
                visible={showModelPicker}
                options={MODEL_OPTIONS}
                selectedId={model}
                onSelect={(id) => handleSelectModel(id as PersonaModelId)}
                onClose={() => setShowModelPicker(false)}
            />
        </SafeAreaView>
    );
}
