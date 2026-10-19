import { Router, Request, Response } from 'express';
import { getFxRates } from '../services/fxService';

/**
 * GET /api/fx/rates — display-only currency rates (see fxService). Public:
 * anonymous visitors see prices in their own currency before signing up.
 */
export const fxRouter = Router();

fxRouter.get('/rates', (_req: Request, res: Response) => {
  // Rates change at most daily; let browsers and the CDN hold them an hour.
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json({ status: 'success', data: getFxRates() });
});
