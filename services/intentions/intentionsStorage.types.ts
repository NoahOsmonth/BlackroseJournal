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
    /** Compact mirror cursor; source-owner persistence arrives in Phase 1 Task 8. */
    sourceRevision?: number;
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
    /**
     * Optional caller-supplied id. The demo seed records the id in its ledger
     * *before* creating the check-in: `createCheckIn` stages a memory file from
     * the row id, so recording it afterwards can strand a staged file whose id
     * never reached the ledger (app killed mid-check-in).
     */
    id?: string;
    intentionId?: string;
    type: IntentionCheckInType;
    title: string;
    summary: string;
    mood?: string;
    personaId?: string;
    messages?: Message[];
    status: IntentionCheckInStatus;
    /** Optional override (seed demo uses daysAgo offsets). Defaults to now. */
    createdAt?: number;
    updatedAt?: number;
}

export interface IntentionCheckInUpdateInput {
    title?: string;
    summary?: string;
    mood?: string;
    personaId?: string;
    messages?: Message[];
    status?: IntentionCheckInStatus;
}
