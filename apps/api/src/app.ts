import cors from 'cors';
import express, { type Express } from 'express';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { addressRouter } from './modules/addresses/address.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { cartRouter } from './modules/cart/cart.routes.js';
import { catalogRouter } from './modules/catalog/catalog.routes.js';
import { orderRouter } from './modules/orders/order.routes.js';
import { createStaffOrderRouter } from './modules/orders/orderManagement.routes.js';
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
  // Story 5.6 — the identical order workflow mounted for admins; the shared
  // Epic 4 service keeps transition/payment rules single-sourced.
  app.use('/api/admin', createStaffOrderRouter('admin'));
  app.use('/api/admin', adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
