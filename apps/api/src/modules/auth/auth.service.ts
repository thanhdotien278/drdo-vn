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

/**
 * Vietnamese-friendly phone: optional country code, then a non-zero digit
 * followed by 8–9 more digits after stripping common separators — rejects
 * obvious duds like 0000000000. Empty string clears the field.
 */
const VN_PHONE_PATTERN = /^(?:\+?84|0)[1-9]\d{8,9}$/;
const vnPhone = z
  .string()
  .trim()
  .max(20)
  .refine((value) => value === '' || VN_PHONE_PATTERN.test(value.replace(/[\s.\-()]/g, '')), {
    message: 'Số điện thoại không hợp lệ',
  });

/**
 * Self-service profile update (PATCH /auth/me). Strictly allow-listed:
 * `email`, `roles`, `status`, `passwordHash` and any other client-supplied
 * fields are stripped by the schema and can never reach the document.
 */
const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Vui lòng nhập họ tên').max(120).optional(),
    phone: vnPhone.optional(),
  })
  .refine((data) => data.fullName !== undefined || data.phone !== undefined, {
    message: 'Vui lòng cung cấp ít nhất một thông tin cần cập nhật',
  });

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại').max(128),
  newPassword: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự').max(128),
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

/**
 * Updates only the authenticated caller's own profile — the target user
 * always comes from the verified token, never from the request body.
 */
export async function updateProfile(userId: string, input: unknown): Promise<UserDto> {
  const data = parseInput(updateProfileSchema, input);
  const user = await UserModel.findById(userId).exec();
  if (!user) {
    throw ApiError.unauthorized();
  }
  if (data.fullName !== undefined) {
    user.fullName = data.fullName;
  }
  if (data.phone !== undefined) {
    user.phone = data.phone;
  }
  await user.save();
  return toUserDto(user);
}

/**
 * Password change requires the current password; a wrong one gets the same
 * generic 401 as a failed login. The new password is hashed with the same
 * bcrypt helper used at registration.
 */
export async function changePassword(userId: string, input: unknown): Promise<void> {
  const data = parseInput(changePasswordSchema, input);
  const user = await UserModel.findById(userId).select('+passwordHash').exec();
  if (!user || !user.passwordHash) {
    throw ApiError.unauthorized();
  }
  if (!(await verifyPassword(data.currentPassword, user.passwordHash))) {
    throw ApiError.unauthorized();
  }
  user.passwordHash = await hashPassword(data.newPassword);
  await user.save();
}
