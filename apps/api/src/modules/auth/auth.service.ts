import { z } from 'zod';
import { UserModel, type UserDocument } from '../../models/User.js';
import { ApiError } from '../../utils/apiError.js';
import { parseInput } from '../../utils/validate.js';
import { toUserDto, type UserDto } from './auth.dto.js';
import { signAccessToken } from './jwt.js';
import { hashPassword, verifyPassword } from './password.js';

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email không hợp lệ').max(254),
  password: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự').max(128),
  fullName: z.string().trim().min(2, 'Vui lòng nhập họ tên').max(120),
  phone: z.string().trim().max(20).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu').max(128),
});

export interface AuthResult {
  token: string;
  user: UserDto;
}

/**
 * Story 1.2 — public registration always creates a `customer` account.
 * The payload carries no role field and any client-supplied `roles`/`status`
 * is stripped by the schema; only an admin route (Epic 5) may create staff.
 */
export async function registerCustomer(input: unknown): Promise<AuthResult> {
  const data = parseInput(registerSchema, input);

  const existing = await UserModel.findOne({ email: data.email }).select('_id').exec();
  if (existing) {
    throw ApiError.conflict('Email đã được đăng ký');
  }

  const user = await UserModel.create({
    email: data.email,
    passwordHash: await hashPassword(data.password),
    fullName: data.fullName,
    phone: data.phone ?? '',
    roles: ['customer'],
    status: 'active',
    lastLoginAt: new Date(),
  });

  return { token: signAccessToken(String(user._id)), user: toUserDto(user) };
}

export async function loginWithPassword(input: unknown): Promise<AuthResult> {
  const data = parseInput(loginSchema, input);

  const user = await UserModel.findOne({ email: data.email }).select('+passwordHash').exec();
  if (!user || !user.passwordHash || !(await verifyPassword(data.password, user.passwordHash))) {
    throw ApiError.unauthorized('Email hoặc mật khẩu không đúng');
  }

  if (user.status === 'blocked') {
    throw new ApiError(403, 'ACCOUNT_BLOCKED', 'Tài khoản đã bị khóa');
  }
  if (user.status !== 'active') {
    throw new ApiError(403, 'ACCOUNT_INACTIVE', 'Tài khoản chưa được kích hoạt');
  }

  user.lastLoginAt = new Date();
  await user.save();

  return { token: signAccessToken(String(user._id)), user: toUserDto(user) };
}

export async function getUserById(userId: string): Promise<UserDto | null> {
  const user: UserDocument | null = await UserModel.findById(userId).exec();
  return user ? toUserDto(user) : null;
}
