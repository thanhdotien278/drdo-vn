import type { UserDocument, UserRole, UserStatus } from '../../models/User.js';

/**
 * Public user shape — the only representation ever returned by the API.
 * `passwordHash` is never exposed (it is also `select: false` on the model).
 */
export interface UserDto {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  roles: UserRole[];
  status: UserStatus;
}

export function toUserDto(user: UserDocument): UserDto {
  return {
    id: String(user._id),
    email: user.email,
    fullName: user.fullName,
    phone: user.phone ?? '',
    roles: user.roles,
    status: user.status,
  };
}
