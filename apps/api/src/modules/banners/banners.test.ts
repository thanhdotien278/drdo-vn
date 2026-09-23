import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

/**
 * Story 7.5 integration checks — admin banner CRUD/image/ordering, the
 * public active-window feed, audit evidence, and RBAC against a real
 * MongoDB test database.
 */

process.env.NODE_ENV = 'test';
const TEST_MONGO_URI =
  process.env.MONGODB_TEST_URI_BANNERS ?? 'mongodb://127.0.0.1:27017/drdo_vn_test_banners';

let server: Server;
let baseUrl: string;

const PASSWORD = 'Password123!';
const DAY = 24 * 3600 * 1000;

const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5EQlI=',
  'base64',
);

async function api(
  method: string,
  path: string,
  options: { token?: string; body?: unknown; formData?: FormData } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body:
      options.formData ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, body };
}

function errorCode(body: Record<string, unknown>): string | undefined {
  return (body.error as { code?: string } | undefined)?.code;
}

async function login(email: string): Promise<string> {
  const res = await api('POST', '/api/auth/login', { body: { email, password: PASSWORD } });
  assert.equal(res.status, 200, `login ${email} failed: ${JSON.stringify(res.body)}`);
  return (res.body.data as { token: string }).token;
}

function bannerForm(fields: Record<string, string>, withImage = true): FormData {
  const form = new FormData();
  if (withImage) {
    form.append('image', new Blob([PNG_BYTES], { type: 'image/png' }), 'banner.png');
  }
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }
  return form;
}

interface AdminBanner {
  id: string;
  imageUrl: string;
  title: string;
  subtitle: string;
  linkUrl: string;
  displayOrder: number;
  startAt: string | null;
  endAt: string | null;
  isActive: boolean;
  isDeleted: boolean;
}

let adminToken = '';
let employeeToken = '';
let customerToken = '';
let bannerA = '';
let bannerB = '';
let bannerC = '';

async function auditEntries(filter: Record<string, unknown>) {
  const { AuditLogModel } = await import('../../models/AuditLog.js');
  return AuditLogModel.find(filter).sort({ createdAt: -1 }).exec();
}

before(async () => {
  const { connectDatabase } = await import('../../db/connect.js');
  const { createApp } = await import('../../app.js');
  const { UserModel } = await import('../../models/User.js');
  const { BannerModel } = await import('../../models/Banner.js');
  const { AuditLogModel } = await import('../../models/AuditLog.js');
  const { hashPassword } = await import('../auth/password.js');

  await connectDatabase(TEST_MONGO_URI);
  await Promise.all([
    UserModel.deleteMany({}),
    BannerModel.deleteMany({}),
    AuditLogModel.deleteMany({}),
  ]);

  const passwordHash = await hashPassword(PASSWORD);
  await UserModel.create([
    { email: 'admin@test.dev', passwordHash, fullName: 'Quản Trị', roles: ['admin'], status: 'active' },
    { email: 'staff@test.dev', passwordHash, fullName: 'Nhân Viên', roles: ['employee'], status: 'active' },
    { email: 'cust@test.dev', passwordHash, fullName: 'Khách Một', roles: ['customer'], status: 'active' },
  ]);

  server = createApp().listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;

  adminToken = await login('admin@test.dev');
  employeeToken = await login('staff@test.dev');
  customerToken = await login('cust@test.dev');
});

after(async () => {
  const { disconnectDatabase } = await import('../../db/connect.js');
  server.close();
  await disconnectDatabase();
});

// ---------- RBAC ----------

test('anonymous gets 401, customer and employee get 403 on admin banner routes', async () => {
  assert.equal((await api('GET', '/api/admin/banners', {})).status, 401);
  for (const token of [customerToken, employeeToken]) {
    for (const [method, path] of [
      ['GET', '/api/admin/banners'],
      ['POST', '/api/admin/banners'],
      ['PATCH', '/api/admin/banners/000000000000000000000000'],
      ['DELETE', '/api/admin/banners/000000000000000000000000'],
    ] as const) {
      const res = await api(method, path, { token });
      assert.equal(res.status, 403, `${method} ${path} must reject non-admin roles`);
    }
  }
  // The public feed stays open.
  assert.equal((await api('GET', '/api/banners', {})).status, 200);
});

// ---------- CRUD + image rules ----------

test('create requires an image and enforces the shared upload rules', async () => {
  const noImage = await api('POST', '/api/admin/banners', {
    token: adminToken,
    formData: bannerForm({ title: 'Không ảnh' }, false),
  });
  assert.equal(noImage.status, 400);
  assert.equal(errorCode(noImage.body), 'INVALID_IMAGE_COUNT');

  const badType = new FormData();
  badType.append('image', new Blob(['nope'], { type: 'text/plain' }), 'evil.txt');
  const rejected = await api('POST', '/api/admin/banners', { token: adminToken, formData: badType });
  assert.equal(rejected.status, 400);
  assert.equal(errorCode(rejected.body), 'UNSUPPORTED_FILE_TYPE');

  const big = new FormData();
  big.append('image', new Blob([Buffer.alloc(6 * 1024 * 1024)], { type: 'image/png' }), 'big.png');
  const tooLarge = await api('POST', '/api/admin/banners', { token: adminToken, formData: big });
  assert.equal(tooLarge.status, 400);
  assert.equal(errorCode(tooLarge.body), 'FILE_TOO_LARGE');
});

test('admin creates banners; images land under /uploads/banners', async () => {
  const create = (fields: Record<string, string>) =>
    api('POST', '/api/admin/banners', { token: adminToken, formData: bannerForm(fields) });

  const a = await create({ title: 'Banner A', subtitle: 'Đang chạy', linkUrl: '/products', displayOrder: '1' });
  assert.equal(a.status, 201, JSON.stringify(a.body));
  bannerA = (a.body.data as AdminBanner).id;
  assert.ok((a.body.data as AdminBanner).imageUrl.startsWith('/uploads/banners/'));

  const b = await create({
    title: 'Banner B',
    displayOrder: '0',
    startAt: new Date(Date.now() - DAY).toISOString(),
    endAt: new Date(Date.now() + DAY).toISOString(),
  });
  assert.equal(b.status, 201);
  bannerB = (b.body.data as AdminBanner).id;

  const c = await create({
    title: 'Banner C (future)',
    displayOrder: '2',
    startAt: new Date(Date.now() + 30 * DAY).toISOString(),
  });
  assert.equal(c.status, 201);
  bannerC = (c.body.data as AdminBanner).id;

  const list = await api('GET', '/api/admin/banners', { token: adminToken });
  assert.equal(list.status, 200);
  const items = list.body.data as AdminBanner[];
  assert.equal(items.length, 3);
  assert.deepEqual(
    items.map((item) => item.title),
    ['Banner B', 'Banner A', 'Banner C (future)'],
    'admin list is sorted by displayOrder',
  );
});

test('public feed returns only active in-window banners in display order', async () => {
  const res = await api('GET', '/api/banners', {});
  assert.equal(res.status, 200);
  const items = res.body.data as AdminBanner[];
  assert.deepEqual(
    items.map((item) => item.title),
    ['Banner B', 'Banner A'],
    'future banner must be excluded; order follows displayOrder',
  );
  assert.ok(items.every((item) => item.imageUrl.startsWith('/uploads/banners/')));
});

test('edit, reorder, and window changes are reflected publicly', async () => {
  const edit = await api('PATCH', `/api/admin/banners/${bannerB}`, {
    token: adminToken,
    formData: bannerForm({ title: 'Banner B+', displayOrder: '5' }, false),
  });
  assert.equal(edit.status, 200, JSON.stringify(edit.body));
  assert.equal((edit.body.data as AdminBanner).title, 'Banner B+');
  assert.equal((edit.body.data as AdminBanner).displayOrder, 5);

  const res = await api('GET', '/api/banners', {});
  assert.deepEqual(
    (res.body.data as AdminBanner[]).map((item) => item.title),
    ['Banner A', 'Banner B+'],
    'reorder moves B after A',
  );

  // Replace the image — the stored URL changes and stays in /uploads/banners.
  const newImage = await api('PATCH', `/api/admin/banners/${bannerA}`, {
    token: adminToken,
    formData: bannerForm({}, true),
  });
  assert.equal(newImage.status, 200);
  const updated = newImage.body.data as AdminBanner;
  assert.ok(updated.imageUrl.startsWith('/uploads/banners/'));

  // Expire banner B — it drops out of the public feed.
  const expire = await api('PATCH', `/api/admin/banners/${bannerB}`, {
    token: adminToken,
    formData: bannerForm({ endAt: new Date(Date.now() - DAY).toISOString() }, false),
  });
  assert.equal(expire.status, 200);
  const after = await api('GET', '/api/banners', {});
  assert.deepEqual(
    (after.body.data as AdminBanner[]).map((item) => item.id),
    [bannerA],
    'expired banner must not be rendered',
  );
});

test('deactivate hides a banner; invalid ranges and deleted rows are rejected', async () => {
  const off = await api('PATCH', `/api/admin/banners/${bannerA}`, {
    token: adminToken,
    formData: bannerForm({ isActive: 'false' }, false),
  });
  assert.equal(off.status, 200);
  const feed = await api('GET', '/api/banners', {});
  assert.equal((feed.body.data as AdminBanner[]).length, 0);

  const back = await api('PATCH', `/api/admin/banners/${bannerA}`, {
    token: adminToken,
    formData: bannerForm({ isActive: 'true' }, false),
  });
  assert.equal(back.status, 200);

  const badRange = await api('PATCH', `/api/admin/banners/${bannerA}`, {
    token: adminToken,
    formData: bannerForm(
      {
        startAt: new Date(Date.now() + DAY).toISOString(),
        endAt: new Date(Date.now() - DAY).toISOString(),
      },
      false,
    ),
  });
  assert.equal(badRange.status, 400, 'startAt after endAt must be rejected');
});

test('soft delete hides the banner from public and the default admin list', async () => {
  const del = await api('DELETE', `/api/admin/banners/${bannerC}`, { token: adminToken });
  assert.equal(del.status, 200);
  assert.equal((del.body.data as AdminBanner).isDeleted, true);

  const publicFeed = await api('GET', '/api/banners', {});
  assert.ok(!(publicFeed.body.data as AdminBanner[]).some((item) => item.id === bannerC));

  const adminList = await api('GET', '/api/admin/banners', { token: adminToken });
  assert.ok(!(adminList.body.data as AdminBanner[]).some((item) => item.id === bannerC));

  const deleted = await api('GET', '/api/admin/banners?status=deleted', { token: adminToken });
  assert.ok((deleted.body.data as AdminBanner[]).some((item) => item.id === bannerC));

  const again = await api('DELETE', `/api/admin/banners/${bannerC}`, { token: adminToken });
  assert.equal(again.status, 409);
  assert.equal(errorCode(again.body), 'BANNER_DELETED');
});

test('banner mutations write audit entries; failures do not', async () => {
  const audits = await auditEntries({ entityType: 'banner', entityId: bannerA });
  const actions = audits.map((entry) => entry.action);
  assert.ok(actions.includes('banner.create'));
  assert.ok(actions.includes('banner.update'));
  assert.ok(actions.includes('banner.status_change'));
  assert.ok(audits.every((entry) => entry.actor.role === 'admin'));

  const delAudits = await auditEntries({ entityType: 'banner', entityId: bannerC });
  assert.ok(delAudits.some((entry) => entry.action === 'banner.delete'));

  const before = (await auditEntries({ entityType: 'banner' })).length;
  await api('DELETE', `/api/admin/banners/${bannerC}`, { token: adminToken });
  await api('POST', '/api/admin/banners', {
    token: adminToken,
    formData: bannerForm({}, false),
  });
  assert.equal(
    (await auditEntries({ entityType: 'banner' })).length,
    before,
    'failed operations must not write audit rows',
  );
});
