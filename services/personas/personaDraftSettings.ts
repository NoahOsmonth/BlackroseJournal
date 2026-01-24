import AsyncStorage from '@react-native-async-storage/async-storage';

const DRAFT_SETTINGS_KEY = '@persona_draft_settings';

export interface PersonaDraftSettings {
    model: string;
    imagination: number;
}

export async function loadPersonaDraftSettings(): Promise<PersonaDraftSettings | null> {
    const json = await AsyncStorage.getItem(DRAFT_SETTINGS_KEY);
    if (!json) return null;
    try {
        return JSON.parse(json) as PersonaDraftSettings;
    } catch {
        return null;
    }
}

export async function savePersonaDraftSettings(settings: PersonaDraftSettings): Promise<void> {
    await AsyncStorage.setItem(DRAFT_SETTINGS_KEY, JSON.stringify(settings));
}

export async function clearPersonaDraftSettings(): Promise<void> {
    await AsyncStorage.removeItem(DRAFT_SETTINGS_KEY);
}
