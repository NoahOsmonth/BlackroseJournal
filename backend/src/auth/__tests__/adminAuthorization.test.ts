import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AdminAuthorizer,
  AuthorizationError,
  requireAdmin,
} from '../adminAuthorization';

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
});
