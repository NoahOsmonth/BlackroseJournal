import type { MemoryAuthConfig } from '../auth/supabaseAuth';

export interface MemoryRuntimeConfig {
  postgrestBaseUrl: string;
  postgrestServerKey: string;
  postgrestKeyKind: 'secret' | 'legacy_service_role';
  deploymentId: string;
  writerEpoch: number;
  writerLeaseId: string;
  writerLeaseToken: string;
  sourceCredentialFingerprint: string;
  mirrorWritesEnabled: boolean;
  auth: MemoryAuthConfig;
}

export type MemoryConfigResult =
  | { ready: true; config: MemoryRuntimeConfig }
  | {
      ready: false;
      dependencies: {
        supabaseAuth: boolean;
        postgrestGateway: boolean;
        deployment: boolean;
      };
    };

type MemoryEnvironment = Readonly<Record<string, string | undefined>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEPLOYMENT_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/i;
const DEFAULT_TIMEOUT_MS = 3_000;

function nonempty(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function parsePositiveInteger(value: string | undefined): number | null {
  const normalized = nonempty(value);
  if (!normalized || !/^\d+$/.test(normalized)) {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return null;
  }
  return parsed;
}

function parseKillSwitch(value: string | undefined): boolean {
  const normalized = nonempty(value);
  if (normalized === null) {
    return true;
  }
  return !/^(0|false)$/i.test(normalized);
}

function parseUrl(value: string | null): URL | null {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol)
      || url.username
      || url.password
      || url.search
      || url.hash
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function normalizeSupabaseUrl(value: string | null): string | null {
  const url = parseUrl(value);
  if (!url || !['', '/'].includes(url.pathname)) {
    return null;
  }
  return url.origin;
}

function normalizePostgrestUrl(value: string | null): string | null {
  const url = parseUrl(value);
  if (!url) {
    return null;
  }
  const pathname = url.pathname.replace(/\/+$/, '');
  url.pathname = pathname.endsWith('/rest/v1')
    ? pathname
    : `${pathname}/rest/v1`.replace(/\/{2,}/g, '/');
  return url.toString().replace(/\/$/, '');
}

export function readMemoryConfig(env: MemoryEnvironment): MemoryConfigResult {
  const supabaseUrl = normalizeSupabaseUrl(nonempty(env.SUPABASE_URL));
  const publishableKey = nonempty(env.SUPABASE_ANON_KEY);
  const explicitPostgrestUrl = nonempty(env.MEMORY_POSTGREST_URL);
  const postgrestBaseUrl = normalizePostgrestUrl(
    explicitPostgrestUrl ?? supabaseUrl,
  );
  const modernSecret = nonempty(env.SUPABASE_SECRET_KEY);
  const legacySecret = nonempty(env.SUPABASE_SERVICE_ROLE_KEY);
  const serverKey = modernSecret ?? legacySecret;
  const deploymentId = nonempty(env.MEMORY_DEPLOYMENT_ID);
  const writerEpoch = parsePositiveInteger(env.MEMORY_WRITER_EPOCH);
  const writerLeaseId = nonempty(env.MEMORY_WRITER_LEASE_ID);
  const writerLeaseToken = nonempty(env.MEMORY_WRITER_LEASE_TOKEN);
  const sourceCredentialFingerprint = nonempty(
    env.MEMORY_SOURCE_CREDENTIAL_FINGERPRINT,
  );
  const mirrorWritesEnabled = parseKillSwitch(env.MEMORY_MIRROR_WRITES_ENABLED);

  const dependencies = {
    supabaseAuth: Boolean(supabaseUrl && publishableKey),
    postgrestGateway: Boolean(postgrestBaseUrl && serverKey),
    deployment: Boolean(
      deploymentId
      && DEPLOYMENT_ID.test(deploymentId)
      && writerEpoch !== null
      && writerLeaseId
      && UUID.test(writerLeaseId)
      && writerLeaseToken
      && sourceCredentialFingerprint
    ),
  };

  if (
    !dependencies.supabaseAuth
    || !dependencies.postgrestGateway
    || !dependencies.deployment
    || !supabaseUrl
    || !publishableKey
    || !postgrestBaseUrl
    || !serverKey
    || !deploymentId
    || writerEpoch === null
    || !writerLeaseId
    || !writerLeaseToken
    || !sourceCredentialFingerprint
  ) {
    return { ready: false, dependencies };
  }

  return {
    ready: true,
    config: {
      postgrestBaseUrl,
      postgrestServerKey: serverKey,
      postgrestKeyKind: modernSecret ? 'secret' : 'legacy_service_role',
      deploymentId,
      writerEpoch,
      writerLeaseId,
      writerLeaseToken,
      sourceCredentialFingerprint,
      mirrorWritesEnabled,
      auth: {
        supabaseUrl,
        supabasePublishableKey: publishableKey,
        timeoutMs: DEFAULT_TIMEOUT_MS,
      },
    },
  };
}
