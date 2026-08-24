import type { AuthenticatedPrincipal } from './supabaseJwtVerifier';

export type AdminRole = 'owner' | 'operator' | 'viewer';

export interface AdminPrincipal {
  userId: string;
  role: AdminRole;
}

export interface AdminAuthorizer {
  findAdmin(userId: string): Promise<AdminPrincipal | null>;
}

export interface ControlAdminRepository {
  findAdminByUserId(userId: string): Promise<AdminPrincipal | null>;
}

export function createControlAdminAuthorizer(
  repository: ControlAdminRepository,
): AdminAuthorizer {
  return {
    async findAdmin(userId: string): Promise<AdminPrincipal | null> {
      const record = await repository.findAdminByUserId(userId);
      if (
        !record
        || record.userId !== userId
        || !(['owner', 'operator', 'viewer'] as const).includes(record.role)
      ) return null;
      return { userId: record.userId, role: record.role };
    },
  };
}

export class AuthorizationError extends Error {
  constructor() {
    super('Administrative access is not authorized.');
    this.name = 'AuthorizationError';
  }
}

export async function requireAdmin(
  principal: AuthenticatedPrincipal,
  authorizer: AdminAuthorizer,
): Promise<AdminPrincipal> {
  const admin = await authorizer.findAdmin(principal.userId);
  if (!admin || admin.userId !== principal.userId) throw new AuthorizationError();
  return admin;
}
