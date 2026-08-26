import { getStorageForAccount } from '@/services/account/accountScopedStorage';
import {
    assertAccountOperationActive,
    runAccountBoundOperation,
} from '@/services/account/accountRuntime';

const DRAFT_SETTINGS_KEY = '@persona_draft_settings';

export interface PersonaDraftSettings {
    model: string;
    imagination: number;
}

export function loadPersonaDraftSettings(): Promise<PersonaDraftSettings | null> {
    return runAccountBoundOperation('persona-draft-load', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        const json = await storage.getItem(DRAFT_SETTINGS_KEY);
        assertAccountOperationActive(context);
        if (!json) return null;
        try {
            return JSON.parse(json) as PersonaDraftSettings;
        } catch {
            return null;
        }
    });
}

export function savePersonaDraftSettings(settings: PersonaDraftSettings): Promise<void> {
    return runAccountBoundOperation('persona-draft-save', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        assertAccountOperationActive(context);
        await storage.setItem(DRAFT_SETTINGS_KEY, JSON.stringify(settings));
        assertAccountOperationActive(context);
    });
}

export function clearPersonaDraftSettings(): Promise<void> {
    return runAccountBoundOperation('persona-draft-clear', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        assertAccountOperationActive(context);
        await storage.removeItem(DRAFT_SETTINGS_KEY);
        assertAccountOperationActive(context);
    });
}
