import dotenv from 'dotenv';

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/drdo',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  // Dev-only fallback keeps `cp .env.example .env` runnable; production must set JWT_SECRET.
  jwtSecret: process.env.JWT_SECRET ?? 'drdo-dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
} as const;
