import { Types } from 'mongoose';
import { z } from 'zod';
import { UserModel, type UserDocument, type UserRole } from '../../models/User.js';
import { ApiError } from '../../utils/apiError.js';
import { parseInput } from '../../utils/validate.js';
import { recordAudit, type AuditActorInput } from '../audit/audit.service.js';
import { hashPassword } from '../auth/password.js';
import { toAdminStaffDto, type AdminStaffDto } from './admin.dto.js';

/**
 * Story 5.5 — staff management (FR-15). Staff accounts reuse the Epic 1
 * password hashing and the same `User` model; there is no parallel password
 * system. Self-lockout is rejected on the backend (`CANNOT_DEACTIVATE_SELF`,
 * `CANNOT_CHANGE_OWN_ROLE`) so the check survives a bypassed frontend.
 */

const STAFF_ROLES = ['admin', 'employee'] as const;

const staffCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email không hợp lệ').max(254),
  password: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự').max(128),
  fullName: z.string().trim().min(2, 'Vui lòng nhập họ tên').max(120),
  phone: z.string().trim().max(20).optional(),
  role: z.enum(STAFF_ROLES),
});

const staffRoleSchema = z.object({
  role: z.enum(STAFF_ROLES),
  note: z.string().trim().max(500).optional(),
});

const staffStatusSchema = z.object({
  status: z.enum(['active', 'inactive']),
  note: z.string().trim().max(500).optional(),
});

export async function listAdminStaff(): Promise<AdminStaffDto[]> {
  const users = await UserModel.find({ roles: { $in: [...STAFF_ROLES] } })
    .sort({ createdAt: 1 })
    .exec();
  return users.map(toAdminStaffDto);
}

async function findStaff(id: string): Promise<UserDocument> {
  if (!Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest('ID nhân sự không hợp lệ');
  }
  const user = await UserModel.findById(id).exec();
  if (!user || !user.roles.some((role) => (STAFF_ROLES as readonly string[]).includes(role))) {
    throw ApiError.notFound('Không tìm thấy tài khoản nhân sự');
  }
  return user;
}

function isSelf(actor: AuditActorInput, target: UserDocument): boolean {
  return String(actor.userId ?? '') === String(target._id);
}

export async function createAdminStaff(
  input: unknown,
  actor: AuditActorInput,
): Promise<AdminStaffDto> {
  const data = parseInput(staffCreateSchema, input);

  const existing = await UserModel.findOne({ email: data.email }).select('_id').exec();
  if (existing) {
    throw new ApiError(409, 'EMAIL_TAKEN', 'Email đã được đăng ký');
  }

  const user = await UserModel.create({
    email: data.email,
    passwordHash: await hashPassword(data.password),
    fullName: data.fullName,
    phone: data.phone ?? '',
    roles: [data.role],
    status: 'active',
  });

  await recordAudit({
    actor,
    action: 'staff.create',
    entityType: 'user',
    entityId: user._id,
    nextValue: { email: user.email, roles: user.roles, status: user.status },
  });

  return toAdminStaffDto(user);
}

export async function setAdminStaffRole(
  id: string,
  input: unknown,
  actor: AuditActorInput,
): Promise<AdminStaffDto> {
  const data = parseInput(staffRoleSchema, input);
  const user = await findStaff(id);

  const previousRoles = [...user.roles] as UserRole[];
  if (previousRoles.length === 1 && previousRoles[0] === data.role) {
    return toAdminStaffDto(user);
  }

  if (isSelf(actor, user)) {
    throw new ApiError(
      409,
      'CANNOT_CHANGE_OWN_ROLE',
      'Không thể thay đổi vai trò của chính mình',
    );
  }

  user.roles = [data.role];
  await user.save();

  await recordAudit({
    actor,
    action: 'staff.role_change',
    entityType: 'user',
    entityId: user._id,
    previousValue: { roles: previousRoles, status: user.status },
    nextValue: { roles: user.roles, status: user.status },
    note: data.note,
  });

  return toAdminStaffDto(user);
}

export async function setAdminStaffStatus(
  id: string,
  input: unknown,
  actor: AuditActorInput,
): Promise<AdminStaffDto> {
  const data = parseInput(staffStatusSchema, input);
  const user = await findStaff(id);

  if (isSelf(actor, user) && data.status !== 'active') {
    throw new ApiError(
      409,
      'CANNOT_DEACTIVATE_SELF',
      'Không thể vô hiệu hóa tài khoản đang đăng nhập',
    );
  }

  if (user.status === data.status) {
    return toAdminStaffDto(user);
  }

  const previousStatus = user.status;
  user.status = data.status;
  await user.save();

  await recordAudit({
    actor,
    action: 'staff.status_change',
    entityType: 'user',
    entityId: user._id,
    previousValue: { roles: user.roles, status: previousStatus },
    nextValue: { roles: user.roles, status: data.status },
    note: data.note,
  });

  return toAdminStaffDto(user);
}
