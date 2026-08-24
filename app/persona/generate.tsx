import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { EmptyState } from '@/components/ui/EmptyState';
import { PersonaForm, PersonaFormValues } from '@/components/personas/PersonaForm';
import { PersonaGenerateInput } from '@/components/personas/PersonaGenerateInput';
import { PersonaGenerateSkeleton } from '@/components/personas/PersonaGenerateSkeleton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { PERSONA_VOICES, PersonaAvatarKey } from '@/constants/personas';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNavBack } from '@/hooks/navigation/useNavBack';
import { usePersonas } from '@/hooks/personas/usePersonas';
import { generatePersonaWithAI } from '@/services/personas/personasAiGeneration';

type Phase = 'describe' | 'generating' | 'review' | 'error';

const ALLOWED_VOICES = [...PERSONA_VOICES];

export default function GeneratePersonaScreen() {
    const router = useRouter();
    const goBack = useNavBack('/persona');
    const colorScheme = useColorScheme();
    const { create, setActive } = usePersonas();
    const [phase, setPhase] = useState<Phase>('describe');
    const [draft, setDraft] = useState<PersonaFormValues | null>(null);

    const handleGenerate = async (description: string) => {
        setPhase('generating');
        try {
            const generated = await generatePersonaWithAI({
                description,
                allowedVoices: ALLOWED_VOICES,
            });
            setDraft({
                name: generated.name,
                tagline: generated.tagline,
                voice: generated.voice,
                prompt: generated.prompt,
                model: generated.model,
                imagination: generated.imagination,
                avatarKey: (generated.avatarKey as PersonaAvatarKey) ?? 'persona-new',
            });
            setPhase('review');
        } catch (error) {
            console.warn('Failed to generate persona with AI:', error);
            setPhase('error');
        }
    };

    const handleSave = async (values: PersonaFormValues) => {
        const persona = await create({
            name: values.name,
            tagline: values.tagline,
            voice: values.voice,
            prompt: values.prompt,
            model: values.model,
            imagination: values.imagination,
            avatarKey: values.avatarKey,
        });
        await setActive(persona.id);
        router.back();
    };

    if (phase === 'generating') {
        return (
            <ScreenContainer edges="all">
                <PersonaGenerateSkeleton />
            </ScreenContainer>
        );
    }

    if (phase === 'error') {
        const iconColor = colorScheme === 'dark' ? '#F9FAFB' : '#111827';
        return (
            <ScreenContainer edges="all">
                <View className="flex-1 max-w-md mx-auto w-full items-center justify-center px-6 gap-3">
                    <View className="flex-row items-center justify-between w-full px-2 py-4">
                        <Pressable onPress={goBack} className="p-2 -ml-2" accessibilityLabel="Back">
                            <MaterialIcons name="arrow-back" size={24} color={iconColor} />
                        </Pressable>
                        <Text className="text-lg font-semibold text-text-light dark:text-text-dark">
                            Generate persona
                        </Text>
                        <View className="w-10" />
                    </View>
                    <EmptyState
                        icon="error-outline"
                        title="Couldn't craft your persona"
                        message="Something went wrong while generating your persona. You can try again or head back."
                        actionLabel="Try again"
                        onActionPress={() => setPhase('describe')}
                    />
                </View>
            </ScreenContainer>
        );
    }

    if (phase === 'review' && draft) {
        return (
            <ScreenContainer edges="all">
                <PersonaForm
                    title="Review persona"
                    submitLabel="Save"
                    initialValues={draft}
                    onBack={() => setPhase('describe')}
                    onSubmit={handleSave}
                    onAdvanced={() => router.push('/persona/advanced')}
                />
            </ScreenContainer>
        );
    }

    return (
        <ScreenContainer edges="all">
            <PersonaGenerateInput
                onBack={() => router.back()}
                onGenerate={handleGenerate}
                isGenerating={false}
            />
        </ScreenContainer>
    );
}
