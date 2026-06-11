import React from 'react';
import { useRouter } from 'expo-router';

import { PersonaSheet } from '@/components/personas/PersonaSheet';
import type { Persona } from '@/services/personas/personasStorage.types';

interface ChatPersonaSheetProps {
    visible: boolean;
    personas: Persona[];
    activePersona: Persona | null;
    onClose: () => void;
    onSelect: (id: string) => void | Promise<void>;
}

/**
 * Persona sheet wiring for the main journal chat. Encapsulates the
 * select/create/generate navigation so `app/chat.tsx` stays lean (it already
 * carries a design-size warning). Settings management is intentionally omitted
 * here — the main chat only needs switch/create/generate, mirroring the
 * intentions-chat pattern.
 */
export function ChatPersonaSheet({
    visible,
    personas,
    activePersona,
    onClose,
    onSelect,
}: ChatPersonaSheetProps) {
    const router = useRouter();
    return (
        <PersonaSheet
            visible={visible}
            personas={personas}
            activePersonaId={activePersona?.id}
            activePersona={activePersona}
            onClose={onClose}
            onSelectPersona={async (persona) => {
                await onSelect(persona.id);
                onClose();
            }}
            onCreatePersona={() => {
                onClose();
                router.push('/persona/new');
            }}
            onGeneratePersona={() => {
                onClose();
                router.push('/persona/generate');
            }}
            onOpenSettings={(persona) => {
                onClose();
                router.push({ pathname: '/persona/[id]', params: { id: persona.id } });
            }}
        />
    );
}
