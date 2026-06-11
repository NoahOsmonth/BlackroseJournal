import React, { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { useRouter } from 'expo-router';

import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { PersonaForm, PersonaFormValues } from '@/components/personas/PersonaForm';
import { PersonaGenerateInput } from '@/components/personas/PersonaGenerateInput';
import { PersonaAvatarKey, PERSONA_VOICES } from '@/constants/personas';
import { usePersonas } from '@/hooks/personas/usePersonas';
import { generatePersonaWithAI } from '@/services/personas/personasAiGeneration';

type Phase = 'describe' | 'generating' | 'review';

const ALLOWED_VOICES = [...PERSONA_VOICES];

export default function GeneratePersonaScreen() {
    const router = useRouter();
    const { create, setActive } = usePersonas();
    const [phase, setPhase] = useState<Phase>('describe');
    const [draft, setDraft] = useState<PersonaFormValues | null>(null);

    const handleGenerate = async (description: string) => {
        setPhase('generating');
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
                <View className="flex-1 items-center justify-center px-8">
                    <ActivityIndicator size="large" color="#FF9F0A" />
                    <Text className="mt-4 text-[16px] text-text-light dark:text-text-dark">
                        Crafting your guide…
                    </Text>
                    <Text className="mt-1 text-[14px] text-text-secondary-light dark:text-text-secondary-dark text-center">
                        AI is shaping a name, tone, and voice.
                    </Text>
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
