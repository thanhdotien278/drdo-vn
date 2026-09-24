export const USER_ROLES = ['customer', 'employee', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  roles: UserRole[];
  status: 'active' | 'blocked' | 'inactive';
  avatarUrl?: string;
}

export interface AuthResult {
  token: string;
  user: AuthUser;
}
