/**
 * Shared fixture for the provider-profile store (schema v2).
 *
 * Tests used to hand-build the flat v1 record, so every rename broke several
 * suites at once. Building the v2 shape in one place keeps that churn here.
 */
import type {
    CustomAiModel,
    CustomAiProviderSettings,
    ProviderProfile,
} from '@/services/ai/customModels';

export const TEST_PROVIDER_HOST = 'https://api.example.com/v1';

export interface ProviderFixture {
    id?: string;
    enabled?: boolean;
    label?: string;
    baseUrl?: string;
    apiKey?: string;
    selectedModelId?: string | null;
    flashModelId?: string | null;
    models?: CustomAiModel[];
    recentModelIds?: readonly string[];
    modelFilterPatterns?: readonly string[];
    fallbackModelIds?: readonly string[];
    contextWindowOverride?: number | null;
    fallbackContextWindow?: number;
}

export function makeProviderProfile(fixture: ProviderFixture = {}): ProviderProfile {
    return {
        id: fixture.id ?? 'profile-test',
        label: fixture.label ?? 'Test provider',
        baseUrl: fixture.baseUrl ?? TEST_PROVIDER_HOST,
        apiKey: fixture.apiKey ?? 'test-key',
        selectedModelId: fixture.selectedModelId ?? null,
        flashModelId: fixture.flashModelId ?? null,
        models: fixture.models ?? [],
        recentModelIds: fixture.recentModelIds ?? [],
        modelFilterPatterns: fixture.modelFilterPatterns ?? [],
        fallbackModelIds: fixture.fallbackModelIds ?? [],
        contextWindowOverride: fixture.contextWindowOverride ?? null,
        fallbackContextWindow: fixture.fallbackContextWindow ?? 128_000,
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
    };
}

export function makeProviderSettings(
    fixture: ProviderFixture = {}
): CustomAiProviderSettings {
    const profile = makeProviderProfile(fixture);
    return {
        schemaVersion: 2,
        enabled: fixture.enabled ?? false,
        activeProfileId: profile.id,
        profiles: [profile],
        updatedAt: 1_700_000_000_000,
    };
}

export function testModel(id: string, contextWindow = 8_000): CustomAiModel {
    return { id, contextWindow, contextWindowSource: 'api' };
}
