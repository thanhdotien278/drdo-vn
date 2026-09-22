import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

/**
 * Story 1.2/1.3 integration checks — real HTTP against the Express app and a
 * dedicated test database. Requires a running MongoDB (same as `npm run
 * seed`); set MONGODB_TEST_URI to override the default test database.
 */

process.env.NODE_ENV = 'test';
const TEST_MONGO_URI =
  process.env.MONGODB_TEST_URI ?? 'mongodb://127.0.0.1:27017/drdo_vn_test';

let server: Server;
let baseUrl: string;

const PASSWORD = 'Password123!';

interface SeedUser {
  email: string;
  roles: string[];
  status: string;
}

const USERS: SeedUser[] = [
  { email: 'customer@test.dev', roles: ['customer'], status: 'active' },
  { email: 'employee@test.dev', roles: ['employee'], status: 'active' },
  { email: 'admin@test.dev', roles: ['admin'], status: 'active' },
  { email: 'blocked@test.dev', roles: ['customer'], status: 'blocked' },
  { email: 'inactive@test.dev', roles: ['customer'], status: 'inactive' },
];

async function api(
  method: string,
  path: string,
  options: { token?: string; body?: unknown } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, body };
}

function errorCode(body: Record<string, unknown>): string | undefined {
  return (body.error as { code?: string } | undefined)?.code;
}

async function login(email: string, password = PASSWORD): Promise<string> {
  const res = await api('POST', '/api/auth/login', { body: { email, password } });
  assert.equal(res.status, 200, `login ${email} failed: ${JSON.stringify(res.body)}`);
  return (res.body.data as { token: string }).token;
}

before(async () => {
  const { connectDatabase } = await import('../../db/connect.js');
  const { createApp } = await import('../../app.js');
  const { UserModel } = await import('../../models/User.js');
  const { hashPassword } = await import('./password.js');

  await connectDatabase(TEST_MONGO_URI);
  await UserModel.deleteMany({}).exec();

  const passwordHash = await hashPassword(PASSWORD);
  for (const user of USERS) {
    await UserModel.create({
      email: user.email,
      passwordHash,
      fullName: `Test ${user.email}`,
      roles: user.roles,
      status: user.status,
    });
  }

  server = createApp().listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  const { disconnectDatabase } = await import('../../db/connect.js');
  server.close();
  await disconnectDatabase();
});

// ---------- Story 1.2: registration ----------

test('customer registration creates a customer-role account and returns a usable token', async () => {
  const res = await api('POST', '/api/auth/register', {
    body: {
      email: 'newcustomer@test.dev',
      password: PASSWORD,
      fullName: 'Khách Mới',
      phone: '0912345678',
    },
  });

  assert.equal(res.status, 201);
  const data = res.body.data as { token: string; user: Record<string, unknown> };
  assert.ok(data.token);
  assert.equal(data.user.email, 'newcustomer@test.dev');
  assert.deepEqual(data.user.roles, ['customer']);
  assert.equal(data.user.status, 'active');
  assert.equal(data.user.passwordHash, undefined);

  const me = await api('GET', '/api/auth/me', { token: data.token });
  assert.equal(me.status, 200);
});

test('registration cannot create employee/admin accounts via payload roles', async () => {
  const res = await api('POST', '/api/auth/register', {
    body: {
      email: 'escalation@test.dev',
      password: PASSWORD,
      fullName: 'Escalation Attempt',
      roles: ['admin'],
      status: 'active',
    },
  });

  assert.equal(res.status, 201);
  const data = res.body.data as { user: { roles: string[] } };
  assert.deepEqual(data.user.roles, ['customer']);
});

test('duplicate email registration is rejected with 409', async () => {
  const res = await api('POST', '/api/auth/register', {
    body: { email: 'customer@test.dev', password: PASSWORD, fullName: 'Duplicate' },
  });
  assert.equal(res.status, 409);
});

test('invalid registration payloads are rejected with 400', async () => {
  const badEmail = await api('POST', '/api/auth/register', {
    body: { email: 'not-an-email', password: PASSWORD, fullName: 'Bad Email' },
  });
  assert.equal(badEmail.status, 400);

  const shortPassword = await api('POST', '/api/auth/register', {
    body: { email: 'short@test.dev', password: '123', fullName: 'Short' },
  });
  assert.equal(shortPassword.status, 400);
});

// ---------- Story 1.2: login / me / logout ----------

test('login works for customer, employee, and admin', async () => {
  for (const user of USERS.filter((entry) => entry.status === 'active')) {
    const res = await api('POST', '/api/auth/login', {
      body: { email: user.email, password: PASSWORD },
    });
    assert.equal(res.status, 200, `${user.email} should log in`);
    const data = res.body.data as { token: string; user: { roles: string[] } };
    assert.ok(data.token);
    assert.deepEqual(data.user.roles, user.roles);
  }
});

test('invalid credentials return 401', async () => {
  const wrongPassword = await api('POST', '/api/auth/login', {
    body: { email: 'customer@test.dev', password: 'wrong-password' },
  });
  assert.equal(wrongPassword.status, 401);

  const unknownEmail = await api('POST', '/api/auth/login', {
    body: { email: 'nobody@test.dev', password: PASSWORD },
  });
  assert.equal(unknownEmail.status, 401);
});

test('GET /auth/me returns the authenticated user without passwordHash', async () => {
  const token = await login('customer@test.dev');
  const res = await api('GET', '/api/auth/me', { token });

  assert.equal(res.status, 200);
  const user = (res.body.data as { user: Record<string, unknown> }).user;
  assert.equal(user.email, 'customer@test.dev');
  assert.deepEqual(user.roles, ['customer']);
  assert.equal(user.passwordHash, undefined);
});

test('anonymous /auth/me returns 401', async () => {
  const res = await api('GET', '/api/auth/me');
  assert.equal(res.status, 401);
});

test('garbage bearer token returns 401', async () => {
  const res = await api('GET', '/api/auth/me', { token: 'not-a-jwt' });
  assert.equal(res.status, 401);
});

test('logout endpoint succeeds for an authenticated user', async () => {
  const token = await login('customer@test.dev');
  const res = await api('POST', '/api/auth/logout', { token });
  assert.equal(res.status, 200);
});

// ---------- Story 1.2/1.3: blocked accounts and RBAC ----------

test('blocked users cannot log in (403)', async () => {
  const res = await api('POST', '/api/auth/login', {
    body: { email: 'blocked@test.dev', password: PASSWORD },
  });
  assert.equal(res.status, 403);
  assert.equal(errorCode(res.body), 'ACCOUNT_BLOCKED');
});

test('inactive users cannot log in (403)', async () => {
  const res = await api('POST', '/api/auth/login', {
    body: { email: 'inactive@test.dev', password: PASSWORD },
  });
  assert.equal(res.status, 403);
  assert.equal(errorCode(res.body), 'ACCOUNT_INACTIVE');
});

test('a blocked user holding a previously valid token gets 401 on protected APIs', async () => {
  const { UserModel } = await import('../../models/User.js');
  const { signAccessToken } = await import('./jwt.js');

  const user = await UserModel.create({
    email: 'temptoken@test.dev',
    passwordHash: await (await import('./password.js')).hashPassword(PASSWORD),
    fullName: 'Soon Blocked',
    roles: ['customer'],
    status: 'active',
  });
  const token = signAccessToken(String(user._id));

  const ok = await api('GET', '/api/customer/rbac-smoke', { token });
  assert.equal(ok.status, 200);

  await UserModel.updateOne({ _id: user._id }, { status: 'blocked' }).exec();

  const denied = await api('GET', '/api/customer/rbac-smoke', { token });
  assert.equal(denied.status, 401);
  assert.equal(errorCode(denied.body), 'ACCOUNT_BLOCKED');
});

test('anonymous protected requests return 401', async () => {
  for (const path of ['/api/customer/rbac-smoke', '/api/employee/rbac-smoke', '/api/admin/rbac-smoke']) {
    const res = await api('GET', path);
    assert.equal(res.status, 401, `${path} should reject anonymous requests`);
  }
});

test('customer cannot access employee/admin APIs (403)', async () => {
  const token = await login('customer@test.dev');
  assert.equal((await api('GET', '/api/customer/rbac-smoke', { token })).status, 200);
  assert.equal((await api('GET', '/api/employee/rbac-smoke', { token })).status, 403);
  assert.equal((await api('GET', '/api/admin/rbac-smoke', { token })).status, 403);
});

test('employee can access operational seam but not admin APIs (403)', async () => {
  const token = await login('employee@test.dev');
  assert.equal((await api('GET', '/api/employee/rbac-smoke', { token })).status, 200);
  assert.equal((await api('GET', '/api/admin/rbac-smoke', { token })).status, 403);
  assert.equal((await api('GET', '/api/customer/rbac-smoke', { token })).status, 403);
});

test('admin can access admin APIs; roles are exact (no implicit employee)', async () => {
  const token = await login('admin@test.dev');
  assert.equal((await api('GET', '/api/admin/rbac-smoke', { token })).status, 200);
  assert.equal((await api('GET', '/api/employee/rbac-smoke', { token })).status, 403);
  assert.equal((await api('GET', '/api/customer/rbac-smoke', { token })).status, 403);
});
