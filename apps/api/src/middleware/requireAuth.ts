import type { NextFunction, Request, Response } from 'express';
import { UserModel } from '../models/User.js';
import { toUserDto } from '../modules/auth/auth.dto.js';
import { verifyAccessToken } from '../modules/auth/jwt.js';
import { ApiError } from '../utils/apiError.js';

function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

/**
 * Requires a valid JWT and an active account. The user is reloaded on every
 * request so a blocked/inactive account loses API access immediately, not
 * just at the next login. Role authorization lives in `requireRole`.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractBearerToken(req.header('authorization'));
    if (!token) {
      throw ApiError.unauthorized();
    }

    let payload: { sub: string };
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new ApiError(401, 'INVALID_TOKEN', 'Phiên đăng nhập không hợp lệ');
    }

    const user = await UserModel.findById(payload.sub).exec();
    if (!user) {
      throw new ApiError(401, 'USER_NOT_FOUND', 'Tài khoản không tồn tại');
    }
    if (user.status === 'blocked') {
      throw new ApiError(401, 'ACCOUNT_BLOCKED', 'Tài khoản đã bị khóa');
    }
    if (user.status !== 'active') {
      throw new ApiError(401, 'ACCOUNT_INACTIVE', 'Tài khoản chưa được kích hoạt');
    }

    req.authUser = toUserDto(user);
    next();
  } catch (error) {
    next(error);
  }
}
