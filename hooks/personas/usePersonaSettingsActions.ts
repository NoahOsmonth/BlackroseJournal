import { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import type { Persona } from '@/services/personas/personasStorage.types';

interface UsePersonaSettingsActionsOptions {
    activePersona?: Persona | null;
    closePersonaSheet: () => void;
    remove: (id: string) => Promise<boolean>;
}

export function usePersonaSettingsActions({
    activePersona,
    closePersonaSheet,
    remove,
}: UsePersonaSettingsActionsOptions) {
    const router = useRouter();
    const [settingsPersona, setSettingsPersona] = useState<Persona | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);

    const closeSettings = () => {
        setSettingsOpen(false);
        setSettingsPersona(null);
    };

    const openSettings = (persona: Persona) => {
        closePersonaSheet();
        setSettingsPersona(persona);
        setSettingsOpen(true);
    };

    const openActiveSettings = () => {
        if (activePersona) {
            openSettings(activePersona);
            return;
        }
        router.push('/persona/new');
    };

    const editPersona = (persona: Persona) => {
        closeSettings();
        router.push({ pathname: '/persona/[id]', params: { id: persona.id } });
    };

    const openAdvanced = (persona: Persona) => {
        closeSettings();
        router.push({ pathname: '/persona/advanced', params: { personaId: persona.id } });
    };

    const deletePersona = (persona: Persona) => {
        Alert.alert('Delete persona?', `This removes ${persona.name} from your device.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    await remove(persona.id);
                    closeSettings();
                },
            },
        ]);
    };

    return {
        settingsOpen,
        settingsPersona,
        closeSettings,
        deletePersona,
        editPersona,
        openActiveSettings,
        openAdvanced,
        openSettings,
    };
}
