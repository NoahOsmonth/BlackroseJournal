import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { getPersona, updatePersona } from '@/services/personas/personasStorage';
import {
    loadPersonaDraftSettings,
    savePersonaDraftSettings,
} from '@/services/personas/personaDraftSettings';
import { ImaginationSlider } from '@/components/personas/ImaginationSlider';
import { ModelPickerModal } from '@/components/personas/ModelPickerModal';

const MODELS = [
    'zai-org/glm-4.7-original:thinking',
    'zai-org/glm-4.7-flash-original',
    'agent-default',
] as const;
const MODEL_LABELS: Record<(typeof MODELS)[number], string> = {
    'zai-org/glm-4.7-original:thinking': 'GLM 4.7 Thinking',
    'zai-org/glm-4.7-flash-original': 'GLM 4.7 Flash',
    'agent-default': 'Agent Default',
};
const MODEL_OPTIONS = MODELS.map((id) => ({ id, label: MODEL_LABELS[id] }));

function getImaginationLabel(value: number): string {
    if (value <= 33) return 'Consistent';
    if (value <= 66) return 'Balanced';
    return 'Creative';
}

function resolveModel(value?: string): (typeof MODELS)[number] {
    if (value && MODELS.includes(value as (typeof MODELS)[number])) {
        return value as (typeof MODELS)[number];
    }
    return MODELS[0];
}

export default function PersonaAdvancedScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const iconColor = colorScheme === 'dark' ? '#F9FAFB' : '#111827';
    const params = useLocalSearchParams<{ personaId?: string }>();
    const personaId = Array.isArray(params.personaId) ? params.personaId[0] : params.personaId;

    const [model, setModel] = useState<(typeof MODELS)[number]>(MODELS[0]);
    const [imagination, setImagination] = useState(25);
    const [showModelPicker, setShowModelPicker] = useState(false);

    useEffect(() => {
        let isActive = true;
        const load = async () => {
            if (personaId) {
                const persona = await getPersona(personaId);
                if (!isActive || !persona) return;
                setModel(resolveModel(persona.model));
                setImagination(persona.imagination ?? 25);
                return;
            }
            const draft = await loadPersonaDraftSettings();
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

    const handleSelectModel = (nextModel: (typeof MODELS)[number]) => {
        setModel(nextModel);
        setShowModelPicker(false);
    };

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="flex-row items-center px-4 py-3 border-b border-divider-light dark:border-divider-dark">
                <Pressable onPress={handleBack} className="p-2 -ml-2">
                    <MaterialIcons name="arrow-back" size={24} color={iconColor} />
                </Pressable>
                <Text className="ml-2 text-[20px] font-semibold text-text-light dark:text-white">Advanced</Text>
            </View>

            <View className="flex-1 max-w-md mx-auto px-4 py-6">
                <View className="mb-2 pl-4">
                    <Text className="text-[13px] font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide">
                        Intelligence
                    </Text>
                </View>
                <View className="bg-surface-light dark:bg-surface-dark rounded-xl overflow-hidden shadow-soft">
                    <Pressable
                        onPress={() => setShowModelPicker(true)}
                        className="flex-row items-center justify-between p-4"
                    >
                        <View className="flex-row items-center gap-3">
                            <MaterialIcons name="auto-awesome" size={26} color="#60A5FA" />
                            <Text className="text-[17px] font-medium text-text-light dark:text-white">AI Model</Text>
                        </View>
                        <View className="flex-row items-center gap-1">
                            <Text className="text-[17px] text-text-secondary-light dark:text-text-secondary-dark">
                                {MODEL_LABELS[model]}
                            </Text>
                            <MaterialIcons name="chevron-right" size={20} color="#9CA3AF" />
                        </View>
                    </Pressable>
                    <View className="pl-16">
                        <View className="h-px bg-divider-light dark:bg-divider-dark" />
                    </View>
                    <View className="p-4">
                        <View className="flex-row items-center justify-between mb-4">
                            <View className="flex-row items-center gap-3">
                                <MaterialIcons name="psychology" size={26} color="#34D399" />
                                <Text className="text-[17px] font-medium text-text-light dark:text-white">Imagination</Text>
                            </View>
                            <Text className="text-[17px] text-text-secondary-light dark:text-text-secondary-dark">
                                {getImaginationLabel(imagination)}
                            </Text>
                        </View>
                        <View className="pl-[52px]">
                            <ImaginationSlider
                                value={imagination}
                                onChange={setImagination}
                            />
                        </View>
                    </View>
                </View>
                <View className="mt-3 px-4">
                    <Text className="text-[13px] leading-[1.4] text-text-secondary-light dark:text-text-secondary-dark">
                        Lower imagination yields consistent responses. Higher sparks variety.
                    </Text>
                </View>
            </View>
            <ModelPickerModal
                visible={showModelPicker}
                options={MODEL_OPTIONS}
                selectedId={model}
                onSelect={(id) => handleSelectModel(id as (typeof MODELS)[number])}
                onClose={() => setShowModelPicker(false)}
            />
        </SafeAreaView>
    );
}
