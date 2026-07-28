export interface PostgrestGateway {
  rpc<T>(
    name: string,
    body: Readonly<Record<string, unknown>>,
  ): Promise<T>;
}

export type PostgrestGatewayErrorCode =
  | 'MEMORY_GATEWAY_RPC_FORBIDDEN'
  | 'MEMORY_GATEWAY_REQUEST_FAILED'
  | 'MEMORY_GATEWAY_UNAVAILABLE'
  | 'MEMORY_GATEWAY_RESPONSE_INVALID';

export class PostgrestGatewayError extends Error {
  constructor(
    readonly code: PostgrestGatewayErrorCode,
    readonly status: number | null,
  ) {
    super(code);
    this.name = 'PostgrestGatewayError';
  }
}

interface PostgrestGatewayConfig {
  postgrestBaseUrl: string;
  postgrestServerKey: string;
  postgrestKeyKind: 'secret' | 'legacy_service_role';
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const ALLOWED_RPCS = new Set([
  'memory_enqueue_job',
  'memory_claim_jobs',
  'memory_finish_job',
  'memory_begin_import',
  'memory_accept_import_chunk',
  'memory_record_deletion',
  'memory_get_bootstrap',
  'memory_get_owner_state',
  'memory_get_source_inventory',
]);

function buildHeaders(config: PostgrestGatewayConfig): Headers {
  const headers = new Headers({
    apikey: config.postgrestServerKey,
    'content-type': 'application/json',
  });
  if (config.postgrestKeyKind === 'legacy_service_role') {
    headers.set('authorization', `Bearer ${config.postgrestServerKey}`);
  }
  return headers;
}

export function createPostgrestGateway(
  config: PostgrestGatewayConfig,
): PostgrestGateway {
  const baseUrl = config.postgrestBaseUrl.replace(/\/+$/, '');
  const fetchImpl = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? 3_000;

  return {
    async rpc<T>(
      name: string,
      body: Readonly<Record<string, unknown>>,
    ): Promise<T> {
      if (!ALLOWED_RPCS.has(name)) {
        throw new PostgrestGatewayError('MEMORY_GATEWAY_RPC_FORBIDDEN', null);
      }

      let response: Response;
      try {
        response = await fetchImpl(`${baseUrl}/rpc/${name}`, {
          method: 'POST',
          headers: buildHeaders(config),
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        throw new PostgrestGatewayError('MEMORY_GATEWAY_UNAVAILABLE', null);
      }

      if (!response.ok) {
        throw new PostgrestGatewayError(
          'MEMORY_GATEWAY_REQUEST_FAILED',
          response.status,
        );
      }

      try {
        return await response.json() as T;
      } catch {
        throw new PostgrestGatewayError(
          'MEMORY_GATEWAY_RESPONSE_INVALID',
          response.status,
        );
      }
    },
  };
}
