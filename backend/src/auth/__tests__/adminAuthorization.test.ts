import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AdminAuthorizer,
  AuthorizationError,
  createControlAdminAuthorizer,
  requireAdmin,
} from '../adminAuthorization';
import { createSupabaseControlAdminRepository } from '../supabaseAdminRepository';

describe('explicit admin authorization', () => {
  it('authorizes only the role returned by the admin data owner', async () => {
    const authorizer: AdminAuthorizer = {
      findAdmin: async (userId) => userId === 'admin-id'
        ? { userId, role: 'owner' }
        : null,
    };

    assert.deepEqual(
      await requireAdmin({ userId: 'admin-id', role: 'authenticated' }, authorizer),
      { userId: 'admin-id', role: 'owner' },
    );
    await assert.rejects(
      () => requireAdmin({ userId: 'regular-id', role: 'authenticated' }, authorizer),
      AuthorizationError,
    );
  });

  it('derives administration from the server-controlled repository only', async () => {
    const authorizer = createControlAdminAuthorizer({
      findAdminByUserId: async (userId) => userId === 'admin-id'
        ? { userId: 'admin-id', role: 'admin' }
        : null,
    });

    assert.deepEqual(await authorizer.findAdmin('admin-id'), {
      userId: 'admin-id',
      role: 'admin',
    });
    assert.equal(await authorizer.findAdmin('regular-id'), null);
  });

  it('accepts the auditor role defined by the control schema', async () => {
    const authorizer = createControlAdminAuthorizer({
      findAdminByUserId: async (userId) => ({ userId, role: 'auditor' }),
    });

    assert.deepEqual(await authorizer.findAdmin('auditor-id'), {
      userId: 'auditor-id',
      role: 'auditor',
    });
  });

  it('maps schema admin rows from the private control REST profile', async () => {
    const repository = createSupabaseControlAdminRepository({
      restUrl: 'https://supabase.example/rest/v1',
      secretKey: 'service-secret',
      fetcher: async () => new Response(JSON.stringify([{
        user_id: 'admin-id',
        role: 'admin',
      }]), { status: 200, headers: { 'content-type': 'application/json' } }),
    });

    assert.deepEqual(await repository.findAdminByUserId('admin-id'), {
      userId: 'admin-id',
      role: 'admin',
    });
  });
});
