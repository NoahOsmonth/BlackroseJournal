import type { MemoryConfigResult } from './memory/config';
import type {
  BootstrapState,
  MemoryRepository,
} from './memory/repositories/memoryRepository';

export interface ReadinessSnapshot {
  ai: boolean;
  supabaseAuth: boolean;
  postgrestGateway: boolean;
  deploymentAuthority: boolean;
}

export interface ReadinessProvider {
  getSnapshot(): ReadinessSnapshot;
}

export interface ReadinessController extends ReadinessProvider {
  refresh(): Promise<ReadinessSnapshot>;
}

interface ReadinessControllerDeps {
  probeAi: () => boolean | Promise<boolean>;
  memoryConfig: MemoryConfigResult;
  repository: MemoryRepository | null;
  /** Fingerprint derived in backend memory from the selected gateway credential. */
  credentialFingerprint?: string | null;
  now?: () => Date;
}

const FINGERPRINT = /^sha256:[A-Za-z0-9][A-Za-z0-9._-]*$/;

function hasSupabaseAuth(config: MemoryConfigResult): boolean {
  if ('dependencies' in config) {
    return config.dependencies.supabaseAuth;
  }
  return true;
}

function validAuthority(
  authority: BootstrapState,
  config: Extract<MemoryConfigResult, { ready: true }>['config'],
  credentialFingerprint: string | null,
  now: Date,
): boolean {
  const expiresAt = authority.writerLeaseExpiresAt
    ? Date.parse(authority.writerLeaseExpiresAt)
    : Number.NaN;
  return authority.deploymentId === config.deploymentId
    && authority.mode === 'active'
    && authority.writerEpoch === config.writerEpoch
    && FINGERPRINT.test(authority.databaseFingerprint)
    && !authority.databaseFingerprint.startsWith('phase0-unprovisioned')
    && authority.writerLeaseId === config.writerLeaseId
    && Number.isFinite(expiresAt)
    && expiresAt > now.getTime()
    && typeof authority.writerLeaseIssuer === 'string'
    && authority.writerLeaseIssuer.trim() !== ''
    && typeof authority.writerLeaseKeyId === 'string'
    && authority.writerLeaseKeyId.trim() !== ''
    && credentialFingerprint !== null
    && credentialFingerprint === config.sourceCredentialFingerprint
    && credentialFingerprint === authority.sourceCredentialFingerprint;
}

export function createReadinessController(
  deps: ReadinessControllerDeps,
): ReadinessController {
  let snapshot: ReadinessSnapshot = {
    ai: false,
    supabaseAuth: hasSupabaseAuth(deps.memoryConfig),
    postgrestGateway: false,
    deploymentAuthority: false,
  };
  let inFlight: Promise<ReadinessSnapshot> | null = null;

  async function runRefresh(): Promise<ReadinessSnapshot> {
    let ai = false;
    try {
      ai = await deps.probeAi();
    } catch {
      ai = false;
    }

    let postgrestGateway = false;
    let deploymentAuthority = false;
    if (deps.memoryConfig.ready && deps.repository) {
      try {
        const authority = await deps.repository.getBootstrap();
        postgrestGateway = true;
        deploymentAuthority = validAuthority(
          authority,
          deps.memoryConfig.config,
          deps.credentialFingerprint ?? null,
          (deps.now ?? (() => new Date()))(),
        );
      } catch {
        postgrestGateway = false;
        deploymentAuthority = false;
      }
    }

    snapshot = {
      ai,
      supabaseAuth: hasSupabaseAuth(deps.memoryConfig),
      postgrestGateway,
      deploymentAuthority,
    };
    return { ...snapshot };
  }

  return {
    getSnapshot() {
      return { ...snapshot };
    },
    refresh() {
      if (!inFlight) {
        inFlight = runRefresh().finally(() => {
          inFlight = null;
        });
      }
      return inFlight;
    },
  };
}
