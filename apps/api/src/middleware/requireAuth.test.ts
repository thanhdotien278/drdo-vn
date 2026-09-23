import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Request } from 'express';
import type { UserDto } from '../modules/auth/auth.dto.js';
import { ApiError } from '../utils/apiError.js';
import { getAuthUser } from './requireAuth.js';

const user: UserDto = {
  id: 'u1',
  email: 'a@b.c',
  fullName: 'A',
  phone: '0900000000',
  roles: ['customer'],
  status: 'active',
};

test('getAuthUser returns the user set by requireAuth', () => {
  const req = { authUser: user } as unknown as Request;
  assert.equal(getAuthUser(req), user);
});

test('getAuthUser throws 401 when requireAuth did not run', () => {
  const req = {} as Request;
  assert.throws(() => getAuthUser(req), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 401);
    assert.equal(error.code, 'UNAUTHORIZED');
    return true;
  });
});
