import {
  isMemoryAuthorityState,
  parseMemoryFeatureFlags,
  type MemoryAuthorityState,
  type MemoryFeatureFlags,
} from '../../../shared/memory/contracts';

export type MemoryRuntimeRoute =
  | {
      readonly effectiveState: 'LOCAL';
      readonly mirrorWrites: false;
      readonly runShadow: false;
      readonly readFromCloud: false;
      readonly writeToCloud: false;
    }
  | {
      readonly effectiveState: 'MIRROR';
      readonly mirrorWrites: true;
      readonly runShadow: false;
      readonly readFromCloud: false;
      readonly writeToCloud: false;
    }
  | {
      readonly effectiveState: 'SHADOW';
      readonly mirrorWrites: true;
      readonly runShadow: true;
      readonly readFromCloud: false;
      readonly writeToCloud: false;
    }
  | {
      readonly effectiveState: 'CLOUD';
      readonly mirrorWrites: false;
      readonly runShadow: false;
      readonly readFromCloud: true;
      readonly writeToCloud: true;
    };

interface ServerIssuedOwnerMemoryState {
  ownerId: string;
  deploymentId: string;
  writerEpoch: number;
  authorityVersion: number;
  authorityState: MemoryAuthorityState;
  featureFlags: MemoryFeatureFlags;
}

interface CurrentMemoryRuntimeBinding {
  sessionOwnerId: string;
  sessionExpiresAtEpochSeconds: number;
  nowEpochSeconds: number;
  expectedDeploymentId: string;
  expectedWriterEpoch: number;
  minimumAuthorityVersion: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATE_KEYS = [
  'ownerId',
  'deploymentId',
  'writerEpoch',
  'authorityVersion',
  'authorityState',
  'featureFlags',
] as const;
const BINDING_KEYS = [
  'sessionOwnerId',
  'sessionExpiresAtEpochSeconds',
  'nowEpochSeconds',
  'expectedDeploymentId',
  'expectedWriterEpoch',
  'minimumAuthorityVersion',
] as const;

function local(): MemoryRuntimeRoute {
  return {
    effectiveState: 'LOCAL',
    mirrorWrites: false,
    runShadow: false,
    readFromCloud: false,
    writeToCloud: false,
  };
}

function isExactRecord(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => actual.includes(key));
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value > 0;
}

function isDeploymentId(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.trim() === value;
}

function parseServerState(value: unknown): ServerIssuedOwnerMemoryState | null {
  if (!isExactRecord(value, STATE_KEYS)) return null;
  const flags = parseMemoryFeatureFlags(value.featureFlags);
  if (
    typeof value.ownerId !== 'string'
    || !UUID.test(value.ownerId)
    || !isDeploymentId(value.deploymentId)
    || !isPositiveSafeInteger(value.writerEpoch)
    || !isPositiveSafeInteger(value.authorityVersion)
    || !isMemoryAuthorityState(value.authorityState)
    || !flags
  ) {
    return null;
  }
  return {
    ownerId: value.ownerId,
    deploymentId: value.deploymentId,
    writerEpoch: value.writerEpoch,
    authorityVersion: value.authorityVersion,
    authorityState: value.authorityState,
    featureFlags: flags,
  };
}

function parseCurrentBinding(value: unknown): CurrentMemoryRuntimeBinding | null {
  if (!isExactRecord(value, BINDING_KEYS)) return null;
  if (
    typeof value.sessionOwnerId !== 'string'
    || !UUID.test(value.sessionOwnerId)
    || typeof value.sessionExpiresAtEpochSeconds !== 'number'
    || !Number.isSafeInteger(value.sessionExpiresAtEpochSeconds)
    || value.sessionExpiresAtEpochSeconds <= 0
    || typeof value.nowEpochSeconds !== 'number'
    || !Number.isSafeInteger(value.nowEpochSeconds)
    || value.nowEpochSeconds < 0
    || value.sessionExpiresAtEpochSeconds <= value.nowEpochSeconds
    || !isDeploymentId(value.expectedDeploymentId)
    || !isPositiveSafeInteger(value.expectedWriterEpoch)
    || !isPositiveSafeInteger(value.minimumAuthorityVersion)
  ) {
    return null;
  }
  return {
    sessionOwnerId: value.sessionOwnerId,
    sessionExpiresAtEpochSeconds: value.sessionExpiresAtEpochSeconds,
    nowEpochSeconds: value.nowEpochSeconds,
    expectedDeploymentId: value.expectedDeploymentId,
    expectedWriterEpoch: value.expectedWriterEpoch,
    minimumAuthorityVersion: value.minimumAuthorityVersion,
  };
}

function bindingMatches(
  state: ServerIssuedOwnerMemoryState,
  binding: CurrentMemoryRuntimeBinding,
): boolean {
  return state.ownerId === binding.sessionOwnerId
    && state.deploymentId === binding.expectedDeploymentId
    && state.writerEpoch === binding.expectedWriterEpoch
    && state.authorityVersion >= binding.minimumAuthorityVersion;
}

export function resolveMemoryRuntime(
  rawServerIssuedState: unknown,
  rawCurrentBinding: unknown,
): MemoryRuntimeRoute {
  const state = parseServerState(rawServerIssuedState);
  if (!state || state.authorityState === 'LOCAL') return local();

  const binding = parseCurrentBinding(rawCurrentBinding);
  if (!binding || !bindingMatches(state, binding)) return local();

  const flags = state.featureFlags;
  if (state.authorityState === 'MIRROR' && flags.cloudSourceMirroring) {
    return {
      effectiveState: 'MIRROR',
      mirrorWrites: true,
      runShadow: false,
      readFromCloud: false,
      writeToCloud: false,
    };
  }
  if (
    state.authorityState === 'SHADOW'
    && flags.cloudSourceMirroring
    && flags.cloudProjectionBuild
    && flags.shadowRetrieval
  ) {
    return {
      effectiveState: 'SHADOW',
      mirrorWrites: true,
      runShadow: true,
      readFromCloud: false,
      writeToCloud: false,
    };
  }
  if (
    state.authorityState === 'CLOUD'
    && flags.cloudReadAuthority
    && flags.cloudWriteAuthority
  ) {
    return {
      effectiveState: 'CLOUD',
      mirrorWrites: false,
      runShadow: false,
      readFromCloud: true,
      writeToCloud: true,
    };
  }
  return local();
}
