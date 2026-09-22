import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env.js';

export interface AccessTokenPayload {
  sub: string;
}

const signOptions: SignOptions = {
  expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
};

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.jwtSecret, signOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.jwtSecret);
  if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
    throw new Error('Invalid token payload');
  }
  return { sub: decoded.sub };
}
