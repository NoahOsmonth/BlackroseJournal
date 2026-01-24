/**
 * Intentions storage types
 */

import { Message } from '@/services/ai/ai';

export type IntentionArea =
    | 'wellbeing'
    | 'career'
    | 'finances'
    | 'family'
    | 'romance'
    | 'community'
    | 'recreation'
    | 'environment'
    | 'spirituality';

export interface Intention {
    id: string;
    title: string;
    description: string;
    area: IntentionArea;
    iconKey?: string;
    imageKey?: string;
    isArchived?: boolean;
    createdAt: number;
    updatedAt: number;
}

export type IntentionCheckInType = 'intention' | 'morning' | 'evening';
export type IntentionCheckInStatus = 'draft' | 'completed';

export interface IntentionCheckIn {
    id: string;
    intentionId?: string;
    type: IntentionCheckInType;
    title: string;
    summary: string;
    mood?: string;
    personaId?: string;
    messages?: Message[];
    status: IntentionCheckInStatus;
    createdAt: number;
    updatedAt: number;
}

export interface IntentionCreateInput {
    title: string;
    description: string;
    area: IntentionArea;
    iconKey?: string;
    imageKey?: string;
}

export interface IntentionUpdateInput {
    title?: string;
    description?: string;
    iconKey?: string;
    imageKey?: string;
    isArchived?: boolean;
}

export interface IntentionCheckInCreateInput {
    intentionId?: string;
    type: IntentionCheckInType;
    title: string;
    summary: string;
    mood?: string;
    personaId?: string;
    messages?: Message[];
    status: IntentionCheckInStatus;
}

export interface IntentionCheckInUpdateInput {
    title?: string;
    summary?: string;
    mood?: string;
    personaId?: string;
    messages?: Message[];
    status?: IntentionCheckInStatus;
}
