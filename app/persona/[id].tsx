import React, { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from 'react-native';

import type { PersonaAvatarKey } from '@/constants/personas';
import { PersonaForm, PersonaFormValues } from '@/components/personas/PersonaForm';
import { usePersonas } from '@/hooks/personas/usePersonas';
import { getPersona } from '@/services/personas/personasStorage';
import { savePersonaDraftSettings } from '@/services/personas/personaDraftSettings';

function isPersonaAvatarKey(value: string | undefined): value is PersonaAvatarKey {
    return value === 'persona-default' || value === 'persona-new';
}

export default function EditPersonaScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ id?: string }>();
    const personaId = Array.isArray(params.id) ? params.id[0] : params.id;
    const { update } = usePersonas();
    const [values, setValues] = useState<PersonaFormValues | null>(null);

    useEffect(() => {
        let isActive = true;
        const load = async () => {
            if (!personaId) return;
            const persona = await getPersona(personaId);
            if (!isActive || !persona) return;
            setValues({
                name: persona.name,
                tagline: persona.tagline,
                voice: persona.voice,
                prompt: persona.prompt,
                model: persona.model,
                imagination: persona.imagination,
                avatarKey: isPersonaAvatarKey(persona.avatarKey) ? persona.avatarKey : undefined,
            });
        };
        load();
        return () => {
            isActive = false;
        };
    }, [personaId]);

    const handleSubmit = async (form: PersonaFormValues) => {
        if (!personaId) return;
        await update(personaId, {
            name: form.name,
            tagline: form.tagline,
            voice: form.voice,
            prompt: form.prompt,
            model: form.model,
            imagination: form.imagination,
            avatarKey: form.avatarKey,
        });
        router.back();
    };

    const handleAdvanced = async () => {
        if (!values) return;
        await savePersonaDraftSettings({ model: values.model, imagination: values.imagination });
        router.push({ pathname: '/persona/advanced', params: { personaId } });
    };

    if (!values) {
        return (
            <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
                <Text>Loading...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <PersonaForm
                title="Edit persona"
                submitLabel="Save"
                initialValues={values}
                onChange={setValues}
                onBack={() => router.back()}
                onSubmit={handleSubmit}
                onAdvanced={handleAdvanced}
            />
        </SafeAreaView>
    );
}
