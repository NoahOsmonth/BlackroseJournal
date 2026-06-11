import React from 'react';
import { useRouter } from 'expo-router';

import { FeedbackCommentModal } from '@/components/intentions/FeedbackCommentModal';
import { PersonaSettingsSheet } from '@/components/personas/PersonaSettingsSheet';
import { PersonaSheet } from '@/components/personas/PersonaSheet';
import type { Persona } from '@/services/personas/personasStorage.types';
import type { AiFeedbackValue } from '@/services/feedback/feedbackStorage';

interface FeedbackModalProps {
    visible: boolean;
    value: AiFeedbackValue;
    comment: string;
    onCommentChange: (comment: string) => void;
    onClose: () => void;
    onSubmit: () => void;
}

interface PersonaSettingsState {
    settingsOpen: boolean;
    settingsPersona: Persona | null;
    closeSettings: () => void;
    editPersona: (persona: Persona) => void;
    openAdvanced: (persona: Persona) => void;
    deletePersona: (persona: Persona) => void;
    openSettings: (persona: Persona) => void;
}

interface IntentionChatOverlaysProps {
    personaSheetOpen: boolean;
    personas: Persona[];
    activePersona?: Persona | null;
    setPersonaSheetOpen: (open: boolean) => void;
    setActive: (id: string) => Promise<unknown>;
    personaSettings: PersonaSettingsState;
    feedbackModalProps: FeedbackModalProps;
}

export function IntentionChatOverlays({
    personaSheetOpen,
    personas,
    activePersona,
    setPersonaSheetOpen,
    setActive,
    personaSettings,
    feedbackModalProps,
}: IntentionChatOverlaysProps) {
    const router = useRouter();

    const routeToPersona = (path: '/persona/new' | '/persona/generate') => {
        setPersonaSheetOpen(false);
        router.push(path);
    };

    return (
        <>
            <PersonaSheet
                visible={personaSheetOpen}
                personas={personas}
                activePersonaId={activePersona?.id}
                activePersona={activePersona}
                onClose={() => setPersonaSheetOpen(false)}
                onSelectPersona={async (persona) => {
                    await setActive(persona.id);
                    setPersonaSheetOpen(false);
                }}
                onCreatePersona={() => routeToPersona('/persona/new')}
                onGeneratePersona={() => routeToPersona('/persona/generate')}
                onOpenSettings={personaSettings.openSettings}
            />
            <PersonaSettingsSheet
                visible={personaSettings.settingsOpen}
                persona={personaSettings.settingsPersona}
                onClose={personaSettings.closeSettings}
                onEdit={personaSettings.editPersona}
                onAdvanced={personaSettings.openAdvanced}
                onDelete={personaSettings.deletePersona}
            />
            <FeedbackCommentModal {...feedbackModalProps} />
        </>
    );
}
