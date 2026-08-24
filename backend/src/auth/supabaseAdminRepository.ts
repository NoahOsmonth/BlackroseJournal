import type { AdminPrincipal, AdminRole, ControlAdminRepository } from './adminAuthorization';

export interface SupabaseControlAdminRepositoryOptions {
  restUrl: string;
  secretKey: string;
  fetcher?: typeof fetch;
}

function parseAdminRows(value: unknown, expectedUserId: string): AdminPrincipal | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const row: unknown = value[0];
  if (typeof row !== 'object' || row === null || Array.isArray(row)) return null;
  const record = row as Record<string, unknown>;
  const role = record.role;
  if (
    record.user_id !== expectedUserId
    || typeof role !== 'string'
    || !(['owner', 'admin', 'auditor'] as const).includes(role as AdminRole)
  ) return null;
  return { userId: expectedUserId, role: role as AdminRole };
}

export function createSupabaseControlAdminRepository(
  options: SupabaseControlAdminRepositoryOptions,
): ControlAdminRepository {
  const fetcher = options.fetcher ?? fetch;
  const baseUrl = options.restUrl.replace(/\/$/, '');
  const secretKey = options.secretKey;
  return {
    async findAdminByUserId(userId: string): Promise<AdminPrincipal | null> {
      const url = new URL(`${baseUrl}/admins`);
      url.searchParams.set('select', 'user_id,role');
      url.searchParams.set('user_id', `eq.${userId}`);
      url.searchParams.set('limit', '1');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5_000);
      timer.unref();
      try {
        const response = await fetcher(url, {
          method: 'GET',
          redirect: 'error',
          signal: controller.signal,
          headers: {
            accept: 'application/json',
            'accept-profile': 'control',
            apikey: secretKey,
            authorization: `Bearer ${secretKey}`,
          },
        });
        if (!response.ok) throw new Error('Administrative repository unavailable.');
        const contentLength = Number(response.headers.get('content-length') ?? '0');
        if (contentLength > 16 * 1024) throw new Error('Administrative repository unavailable.');
        const text = await response.text();
        if (Buffer.byteLength(text, 'utf8') > 16 * 1024) {
          throw new Error('Administrative repository unavailable.');
        }
        return parseAdminRows(JSON.parse(text) as unknown, userId);
      } catch {
        throw new Error('Administrative repository unavailable.');
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
