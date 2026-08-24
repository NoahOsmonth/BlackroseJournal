import React, { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import type { PersonaAvatarKey } from '@/constants/personas';
import { EmptyState } from '@/components/ui/EmptyState';
import { PersonaForm, PersonaFormValues } from '@/components/personas/PersonaForm';
import { usePersonas } from '@/hooks/personas/usePersonas';
import { useNavBack } from '@/hooks/navigation/useNavBack';
import { getPersona } from '@/services/personas/personasStorage';
import { savePersonaDraftSettings } from '@/services/personas/personaDraftSettings';
import { LoadingStatus } from '@/components/ui/LoadingStatus';

function isPersonaAvatarKey(value: string | undefined): value is PersonaAvatarKey {
    return value === 'persona-default' || value === 'persona-new';
}

export default function EditPersonaScreen() {
    const router = useRouter();
    const goBack = useNavBack('/persona');
    const params = useLocalSearchParams<{ id?: string }>();
    const personaId = Array.isArray(params.id) ? params.id[0] : params.id;
    const { update } = usePersonas();
    const [values, setValues] = useState<PersonaFormValues | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isActive = true;
        const load = async () => {
            if (!personaId) {
                if (isActive) setIsLoading(false);
                return;
            }
            const persona = await getPersona(personaId);
            if (!isActive) return;
            setIsLoading(false);
            if (!persona) return;
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

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
                <View className="flex-1 items-center justify-center px-6">
                    <LoadingStatus label="Loading your persona" detail="Getting your settings ready." />
                </View>
            </SafeAreaView>
        );
    }

    if (!values) {
        return (
            <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
                <View className="flex-1 items-center justify-center px-6">
                    <EmptyState
                        icon="person-off"
                        title="Persona not found"
                        message="This persona may have been deleted or is no longer available."
                        actionLabel="Go back"
                        onActionPress={goBack}
                    />
                </View>
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
