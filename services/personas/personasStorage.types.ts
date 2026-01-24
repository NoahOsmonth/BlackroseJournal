/**
 * Persona storage types
 */

export interface Persona {
    id: string;
    name: string;
    tagline: string;
    voice: string;
    prompt: string;
    model: string;
    imagination: number;
    avatarKey?: string;
    isActive?: boolean;
    createdAt: number;
    updatedAt: number;
}

export interface PersonaCreateInput {
    name: string;
    tagline: string;
    voice: string;
    prompt: string;
    model: string;
    imagination: number;
    avatarKey?: string;
}

export interface PersonaUpdateInput {
    name?: string;
    tagline?: string;
    voice?: string;
    prompt?: string;
    model?: string;
    imagination?: number;
    avatarKey?: string;
    isActive?: boolean;
}
