import {
  adminConsoleReducer,
  createInitialAdminConsoleState,
  type AdminConsoleState,
} from '../adminConsoleState';

const provider = {
  id: 'provider-1',
  name: 'Primary',
  protocol: 'openai-responses' as const,
  baseUrl: 'https://api.example.com/v1',
  state: 'active' as const,
  revision: 2,
  createdAt: '2026-08-24T00:00:00.000Z',
  updatedAt: '2026-08-24T00:00:00.000Z',
};

describe('adminConsoleReducer', () => {
  it('selects a provider and atomically installs its detail data', () => {
    const state = adminConsoleReducer(createInitialAdminConsoleState(), {
      type: 'providerLoaded',
      provider,
      models: [{
        id: 'model-1',
        providerId: 'provider-1',
        upstreamModelId: 'gpt-example',
        label: 'GPT Example',
        capabilities: {},
        rawSafeMetadata: {},
        state: 'active',
        revision: 1,
        discoveredAt: '2026-08-24T00:00:00.000Z',
        updatedAt: '2026-08-24T00:00:00.000Z',
      }],
      health: {
        providerId: 'provider-1',
        status: 'healthy',
        modelCount: 1,
        checkedAt: '2026-08-24T00:00:00.000Z',
      },
    });

    expect(state.selectedProvider?.id).toBe('provider-1');
    expect(state.inventory).toHaveLength(1);
    expect(state.health?.status).toBe('healthy');
    expect(state.error).toBeNull();
  });

  it('keeps current data visible while presenting a resolvable stale-revision conflict', () => {
    const initial: AdminConsoleState = {
      ...createInitialAdminConsoleState(),
      providers: [provider],
      selectedProvider: provider,
    };
    const state = adminConsoleReducer(initial, {
      type: 'revisionConflict',
      message: 'This provider changed in another admin session.',
      currentRevision: 5,
    });

    expect(state.selectedProvider).toBe(provider);
    expect(state.conflict).toEqual({
      message: 'This provider changed in another admin session.',
      currentRevision: 5,
    });
  });
});
