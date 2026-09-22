import cors from 'cors';
import express, { type Express } from 'express';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { addressRouter } from './modules/addresses/address.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { cartRouter } from './modules/cart/cart.routes.js';
import { catalogRouter } from './modules/catalog/catalog.routes.js';
import { orderRouter } from './modules/orders/order.routes.js';
import { createStaffOrderRouter } from './modules/orders/orderManagement.routes.js';
import { rbacSmokeRouter } from './modules/rbac/rbac.routes.js';
import { UPLOADS_ROOT } from './utils/uploads.js';

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

  app.use('/api', authRouter);
  app.use('/api', catalogRouter);
  app.use('/api', cartRouter);
  app.use('/api', addressRouter);
  app.use('/api', orderRouter);
  app.use('/api/employee', createStaffOrderRouter('employee'));
  app.use('/api', rbacSmokeRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
