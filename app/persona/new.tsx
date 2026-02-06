import React, { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
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
    model: 'moonshotai/kimi-k2.5:thinking',
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
