import path from 'node:path';
import cors from 'cors';
import express, { type Express } from 'express';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { catalogRouter } from './modules/catalog/catalog.routes.js';

export const UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads');

export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: env.corsOrigin.split(',').map((origin) => origin.trim()) }));
  app.use(express.json());
  if (env.nodeEnv !== 'test') {
    app.use(morgan('dev'));
  }

  app.use('/uploads', express.static(UPLOADS_ROOT));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api', catalogRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
