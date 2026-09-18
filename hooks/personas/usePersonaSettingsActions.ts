import { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import type { Persona } from '@/services/personas/personasStorage.types';
import { webConfirm } from '@/components/ui/webConfirm';

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
        const message = `This removes ${persona.name} from your device.`;
        const runDelete = async () => {
            await remove(persona.id);
            closeSettings();
        };
        const confirmed = webConfirm(message);
        if (confirmed !== null) {
            if (confirmed) void runDelete();
            return;
        }
        Alert.alert('Delete persona?', message, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: runDelete },
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
