import type { UserDto } from '../modules/auth/auth.dto.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by `requireAuth` after the bearer token and account status pass. */
    authUser?: UserDto;
  }
}

export {};
