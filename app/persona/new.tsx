import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PersonaForm, PersonaFormValues } from '@/components/personas/PersonaForm';
import { usePersonas } from '@/hooks/personas/usePersonas';
import {
    clearPersonaDraftSettings,
    loadPersonaDraftSettings,
    savePersonaDraftSettings,
} from '@/services/personas/personaDraftSettings';

const defaultValues: PersonaFormValues = {
    name: '',
    tagline: '',
    voice: 'Onyx',
    prompt: '',
    model: 'nvidia/nemotron-3-ultra-550b-a55b',
    imagination: 25,
    avatarKey: 'persona-default',
};

export default function NewPersonaScreen() {
    const router = useRouter();
    const { create } = usePersonas();
    const [values, setValues] = useState<PersonaFormValues>(defaultValues);

    useEffect(() => {
        let isActive = true;
        const loadDraft = async () => {
            const draft = await loadPersonaDraftSettings();
            if (!isActive || !draft) return;
            setValues((prev) => ({
                ...prev,
                model: draft.model,
                imagination: draft.imagination,
            }));
        };
        loadDraft();
        return () => {
            isActive = false;
        };
    }, []);

    const handleSubmit = async (form: PersonaFormValues) => {
        await create({
            name: form.name,
            tagline: form.tagline,
            voice: form.voice,
            prompt: form.prompt,
            model: form.model,
            imagination: form.imagination,
            avatarKey: form.avatarKey,
        });
        await clearPersonaDraftSettings();
        router.back();
    };

    const handleAdvanced = async () => {
        await savePersonaDraftSettings({ model: values.model, imagination: values.imagination });
        router.push('/persona/advanced');
    };

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="px-4 pt-3">
                <Pressable
                    onPress={() => router.push('/persona/generate')}
                    className="flex-row items-center justify-center gap-2 py-3 rounded-2xl border border-primary"
                    accessibilityLabel="Generate persona with AI"
                >
                    <MaterialIcons name="auto-awesome" size={18} color="#FF9F0A" />
                    <Text className="text-[15px] font-semibold text-primary">Generate with AI</Text>
                </Pressable>
            </View>
            <PersonaForm
                title="New persona"
                submitLabel="Create"
                initialValues={values}
                onChange={setValues}
                onBack={() => router.back()}
                onSubmit={handleSubmit}
                onAdvanced={handleAdvanced}
            />
        </SafeAreaView>
    );
}
