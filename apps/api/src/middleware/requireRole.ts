import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { UserRole } from '../models/User.js';
import { ApiError } from '../utils/apiError.js';

/**
 * Requires the authenticated user to hold at least one of the given roles.
 * Must run after `requireAuth`. Roles are exact — `admin` does not implicitly
 * satisfy `employee`. Backend RBAC is the security boundary; frontend checks
 * are UX only.
 */
export function requireAnyRole(...allowedRoles: UserRole[]): RequestHandler {
  if (allowedRoles.length === 0) {
    throw new Error('requireAnyRole requires at least one role');
  }

  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.authUser;
    if (!user) {
      next(ApiError.unauthorized());
      return;
    }
    if (!allowedRoles.some((role) => user.roles.includes(role))) {
      next(ApiError.forbidden());
      return;
    }
    next();
  };
}

export function requireRole(role: UserRole): RequestHandler {
  return requireAnyRole(role);
}
