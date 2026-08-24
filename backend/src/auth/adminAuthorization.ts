import type { AuthenticatedPrincipal } from './supabaseJwtVerifier';

export type AdminRole = 'owner' | 'operator' | 'viewer';

export interface AdminPrincipal {
  userId: string;
  role: AdminRole;
}

export interface AdminAuthorizer {
  findAdmin(userId: string): Promise<AdminPrincipal | null>;
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
