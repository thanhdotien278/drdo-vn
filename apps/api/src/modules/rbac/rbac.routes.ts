import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireRole } from '../../middleware/requireRole.js';

/**
 * Story 1.3 — RBAC smoke seams. Real customer/employee/admin feature routes
 * (Epics 3-5) replace these; they keep the `requireAuth` + `requireRole`
 * chain verifiable end to end until then.
 */
export const rbacSmokeRouter = Router();

function respond(area: string, req: Request, res: Response): void {
  res.json({
    data: { ok: true, area, userId: req.authUser!.id, roles: req.authUser!.roles },
  });
}

rbacSmokeRouter.get('/customer/rbac-smoke', requireAuth, requireRole('customer'), (req, res) => {
  respond('customer', req, res);
});

rbacSmokeRouter.get('/employee/rbac-smoke', requireAuth, requireRole('employee'), (req, res) => {
  respond('employee', req, res);
});

rbacSmokeRouter.get('/admin/rbac-smoke', requireAuth, requireRole('admin'), (req, res) => {
  respond('admin', req, res);
});
