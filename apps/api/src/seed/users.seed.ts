import { UserModel, type UserRole, type UserStatus } from '../models/User.js';
import { hashPassword } from '../modules/auth/password.js';

/**
 * Story 1.4 — development accounts. Credentials are documented in the root
 * README for local verification only; they are not real secrets.
 */
export const SEED_USERS: Array<{
  email: string;
  password: string;
  fullName: string;
  phone: string;
  roles: UserRole[];
  status: UserStatus;
}> = [
  {
    email: 'admin@drdo.vn',
    password: 'Admin123!',
    fullName: 'Quản trị DrDo',
    phone: '0900000001',
    roles: ['admin'],
    status: 'active',
  },
  {
    email: 'employee@drdo.vn',
    password: 'Employee123!',
    fullName: 'Nhân viên DrDo',
    phone: '0900000002',
    roles: ['employee'],
    status: 'active',
  },
  {
    email: 'customer@drdo.vn',
    password: 'Customer123!',
    fullName: 'Khách hàng DrDo',
    phone: '0900000003',
    roles: ['customer'],
    status: 'active',
  },
  // Blocked account so the FR-01.4 rejection path is verifiable by hand.
  {
    email: 'blocked@drdo.vn',
    password: 'Blocked123!',
    fullName: 'Khách Bị Khóa',
    phone: '0900000004',
    roles: ['customer'],
    status: 'blocked',
  },
];

export async function seedUsers(): Promise<string> {
  for (const seed of SEED_USERS) {
    await UserModel.findOneAndUpdate(
      { email: seed.email },
      {
        $set: {
          email: seed.email,
          passwordHash: await hashPassword(seed.password),
          fullName: seed.fullName,
          phone: seed.phone,
          roles: seed.roles,
          status: seed.status,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).exec();
  }
  return `${SEED_USERS.length} users (${SEED_USERS.map((user) => user.email).join(', ')})`;
}
