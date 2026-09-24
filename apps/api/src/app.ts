import cors from 'cors';
import express, { type Express } from 'express';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { addressRouter } from './modules/addresses/address.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { adminBannerRouter, publicBannerRouter } from './modules/banners/banner.routes.js';
import { cartRouter } from './modules/cart/cart.routes.js';
import { catalogRouter } from './modules/catalog/catalog.routes.js';
import { loyaltyAdminRouter } from './modules/loyalty/loyaltyAdmin.routes.js';
import { loyaltyRouter } from './modules/loyalty/loyalty.routes.js';
import { orderRouter } from './modules/orders/order.routes.js';
import { createStaffOrderRouter } from './modules/orders/orderManagement.routes.js';
import { promotionAdminRouter } from './modules/promotions/promotionAdmin.routes.js';
import { reviewRouter } from './modules/reviews/review.routes.js';
import { createStaffReviewRouter } from './modules/reviews/reviewModeration.routes.js';
import { wishlistRouter } from './modules/wishlist/wishlist.routes.js';
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
  // Epic 7 — customer engagement: wishlist, reviews (public list + customer
  // writes), and the public banner feed.
  app.use('/api', wishlistRouter);
  app.use('/api', reviewRouter);
  app.use('/api', publicBannerRouter);
  // Epic 8 — customer loyalty summary/history.
  app.use('/api', loyaltyRouter);
  app.use('/api/employee', createStaffOrderRouter('employee'));
  // Story 7.4 — the identical moderation workflow mounted for both staff
  // roles; the shared service keeps approve/reject/delete single-sourced.
  app.use('/api/employee', createStaffReviewRouter('employee'));
  app.use('/api/admin', createStaffReviewRouter('admin'));
  // Story 5.6 — the identical order workflow mounted for admins; the shared
  // Epic 4 service keeps transition/payment rules single-sourced.
  app.use('/api/admin', createStaffOrderRouter('admin'));
  app.use('/api/admin', adminBannerRouter);
  // Epic 8 — admin tier config and manual point adjustments.
  app.use('/api/admin', loyaltyAdminRouter);
  // Epic 9 — admin promotion/coupon management.
  app.use('/api/admin', promotionAdminRouter);
  app.use('/api/admin', adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
