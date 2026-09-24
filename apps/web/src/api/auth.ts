import type { AuthResult, AuthUser } from '../types/auth';
import { apiRequest } from './client';

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}

export function registerAccount(input: RegisterInput): Promise<{ data: AuthResult }> {
  return apiRequest<AuthResult>('POST', '/auth/register', { body: input });
}

export function loginAccount(input: { email: string; password: string }): Promise<{ data: AuthResult }> {
  return apiRequest<AuthResult>('POST', '/auth/login', { body: input });
}

export function fetchCurrentUser(): Promise<{ data: { user: AuthUser } }> {
  return apiRequest<{ user: AuthUser }>('GET', '/auth/me');
}

export interface UpdateProfileInput {
  fullName?: string;
  phone?: string;
}

export function updateProfile(input: UpdateProfileInput): Promise<{ data: { user: AuthUser } }> {
  return apiRequest<{ user: AuthUser }>('PATCH', '/auth/me', { body: input });
}

export function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ data: { ok: boolean } }> {
  return apiRequest<{ ok: boolean }>('PATCH', '/auth/password', { body: input });
}

export function logoutAccount(): Promise<{ data: { ok: boolean } }> {
  return apiRequest<{ ok: boolean }>('POST', '/auth/logout');
}
