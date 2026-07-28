import {
  resolveMemoryRuntime,
  type MemoryRuntimeRoute,
} from '../../../services/memory/cloud/memoryAuthority';
import {
  MEMORY_AUTHORITY_STATES,
  type MemoryAuthorityState,
  type MemoryFeatureFlags,
} from '../../../shared/memory/contracts';

const ownerA = '00000000-0000-4000-8000-00000000000a';
const ownerB = '00000000-0000-4000-8000-00000000000b';
const flagKeys = [
  'cloudSourceMirroring',
  'cloudProjectionBuild',
  'shadowRetrieval',
  'cloudReadAuthority',
  'cloudWriteAuthority',
] as const;

const routes = {
  LOCAL: {
    effectiveState: 'LOCAL',
    mirrorWrites: false,
    runShadow: false,
    readFromCloud: false,
    writeToCloud: false,
  },
  MIRROR: {
    effectiveState: 'MIRROR',
    mirrorWrites: true,
    runShadow: false,
    readFromCloud: false,
    writeToCloud: false,
  },
  SHADOW: {
    effectiveState: 'SHADOW',
    mirrorWrites: true,
    runShadow: true,
    readFromCloud: false,
    writeToCloud: false,
  },
  CLOUD: {
    effectiveState: 'CLOUD',
    mirrorWrites: false,
    runShadow: false,
    readFromCloud: true,
    writeToCloud: true,
  },
} as const satisfies Record<MemoryAuthorityState, MemoryRuntimeRoute>;

function flagsFor(mask: number): MemoryFeatureFlags {
  return Object.fromEntries(
    flagKeys.map((key, index) => [key, Boolean(mask & (1 << index))]),
  ) as unknown as MemoryFeatureFlags;
}

function serverState(
  authorityState: MemoryAuthorityState,
  featureFlags: unknown,
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    ownerId: ownerA,
    deploymentId: 'blackrose-primary',
    writerEpoch: 11,
    authorityVersion: 7,
    authorityState,
    featureFlags,
    ...overrides,
  };
}

function currentBinding(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    sessionOwnerId: ownerA,
    sessionExpiresAtEpochSeconds: 2_000_000_000,
    nowEpochSeconds: 1_800_000_000,
    expectedDeploymentId: 'blackrose-primary',
    expectedWriterEpoch: 11,
    minimumAuthorityVersion: 7,
    ...overrides,
  };
}

function expectedRoute(
  state: MemoryAuthorityState,
  flags: MemoryFeatureFlags,
): MemoryRuntimeRoute {
  if (state === 'MIRROR' && flags.cloudSourceMirroring) return routes.MIRROR;
  if (
    state === 'SHADOW'
    && flags.cloudSourceMirroring
    && flags.cloudProjectionBuild
    && flags.shadowRetrieval
  ) {
    return routes.SHADOW;
  }
  if (state === 'CLOUD' && flags.cloudReadAuthority && flags.cloudWriteAuthority) {
    return routes.CLOUD;
  }
  return routes.LOCAL;
}

describe('resolveMemoryRuntime', () => {
  it.each(MEMORY_AUTHORITY_STATES)(
    'evaluates every valid flag combination for %s',
    (state) => {
      for (let mask = 0; mask < 32; mask += 1) {
        const flags = flagsFor(mask);
        expect(resolveMemoryRuntime(
          serverState(state, flags),
          currentBinding(),
        )).toEqual(expectedRoute(state, flags));
      }
    },
  );

  it('returns independent objects with exact route shapes', () => {
    const flags = flagsFor(31);
    const first = resolveMemoryRuntime(serverState('CLOUD', flags), currentBinding());
    const second = resolveMemoryRuntime(serverState('CLOUD', flags), currentBinding());
    expect(first).toEqual(routes.CLOUD);
    expect(second).toEqual(routes.CLOUD);
    expect(first).not.toBe(second);
  });

  it.each([
    null,
    'CLOUD',
    serverState('CLOUD', { ...flagsFor(31), futureFlag: true }),
    serverState('CLOUD', { ...flagsFor(31), cloudWriteAuthority: 'yes' }),
    serverState('CLOUD', { cloudReadAuthority: true, cloudWriteAuthority: true }),
    serverState('CLOUD', flagsFor(31), { ownerId: 'not-a-uuid' }),
    serverState('CLOUD', flagsFor(31), { authorityState: 'cloud' }),
    serverState('CLOUD', flagsFor(31), { authorityVersion: 0 }),
    serverState('CLOUD', flagsFor(31), { writerEpoch: 0 }),
    serverState('CLOUD', flagsFor(31), { unexpected: true }),
  ])('fails malformed or extra-key server state closed to LOCAL: %#', (state) => {
    expect(resolveMemoryRuntime(state, currentBinding())).toEqual(routes.LOCAL);
  });

  it.each([
    null,
    { sessionOwnerId: ownerA },
    currentBinding({ sessionOwnerId: ownerB }),
    currentBinding({ sessionOwnerId: 'not-a-uuid' }),
    currentBinding({ sessionExpiresAtEpochSeconds: 1_800_000_000 }),
    currentBinding({ expectedDeploymentId: 'other-deployment' }),
    currentBinding({ expectedWriterEpoch: 10 }),
    currentBinding({ minimumAuthorityVersion: 8 }),
    currentBinding({ unexpected: true }),
  ])('fails missing, expired, stale, or mismatched binding closed to LOCAL: %#', (binding) => {
    expect(resolveMemoryRuntime(
      serverState('CLOUD', flagsFor(31)),
      binding,
    )).toEqual(routes.LOCAL);
  });

  it('does not let a binding upgrade a server-issued LOCAL state', () => {
    expect(resolveMemoryRuntime(
      serverState('LOCAL', flagsFor(31)),
      currentBinding(),
    )).toEqual(routes.LOCAL);
  });
});
