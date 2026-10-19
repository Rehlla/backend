import { Router, Response } from 'express';
import { dahabKnowledgeOs } from '../services/dahabKnowledgeOs';
import { conflictEngine } from '../services/conflictEngine';
import { snapshotService } from '../services/snapshotService';
import { entityResolutionService } from '../services/entityResolutionService';
import { knowledgeGapService } from '../services/knowledgeGapService';
import { requireAuth } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { AuthenticatedRequest } from '../middleware/correlationMiddleware';
import { db } from '../db/database';
import { isFactStale } from '../domain/factFreshness';
import { runDkosLiveProductProof } from '../test/runDkosLiveProductProof';

export const adminDahabRouter = Router();

// Apply Auth and Role Check to all Admin DKOS endpoints
adminDahabRouter.use(requireAuth);
adminDahabRouter.use(requireRole('Operations', 'Admin', 'Product'));

/**
 * GET /api/dahab/admin/health
 * Knowledge Operating System Health & Quality Dashboard
 */
adminDahabRouter.get('/health', (req: AuthenticatedRequest, res: Response) => {
  const health = dahabKnowledgeOs.getKnowledgeHealth();
  res.json({
    status: 'success',
    health,
    correlationId: req.correlationId
  });
});

/**
 * GET /api/dahab/admin/conflicts
 */
adminDahabRouter.get('/conflicts', (req: AuthenticatedRequest, res: Response) => {
  const conflicts = db.conflictSets;
  res.json({
    status: 'success',
    count: conflicts.length,
    openCount: conflicts.filter(c => c.status === 'OPEN').length,
    conflicts,
    correlationId: req.correlationId
  });
});

/**
 * POST /api/dahab/admin/conflicts/resolve
 */
adminDahabRouter.post('/conflicts/resolve', (req: AuthenticatedRequest, res: Response) => {
  const { conflictId, resolvedValue } = req.body;
  if (!conflictId) {
    return res.status(400).json({
      status: 'error',
      message: 'conflictId is required',
      correlationId: req.correlationId
    });
  }

  const actor = req.user?.name || 'Operations Lead';
  const resolved = conflictEngine.resolveConflict(conflictId, resolvedValue, actor);

  res.json({
    status: 'success',
    resolvedConflict: resolved,
    correlationId: req.correlationId
  });
});

/**
 * GET /api/dahab/admin/snapshots
 */
adminDahabRouter.get('/snapshots', (req: AuthenticatedRequest, res: Response) => {
  const snapshots = db.knowledgeSnapshots;
  res.json({
    status: 'success',
    count: snapshots.length,
    snapshots,
    correlationId: req.correlationId
  });
});

/**
 * POST /api/dahab/admin/snapshots/create
 */
adminDahabRouter.post('/snapshots/create', (req: AuthenticatedRequest, res: Response) => {
  const { versionTag } = req.body;
  const snapshot = snapshotService.createSnapshot(versionTag);
  res.json({
    status: 'success',
    message: `Knowledge snapshot '${snapshot.versionId}' created successfully.`,
    snapshot,
    correlationId: req.correlationId
  });
});

/**
 * POST /api/dahab/admin/snapshots/diff
 */
adminDahabRouter.post('/snapshots/diff', (req: AuthenticatedRequest, res: Response) => {
  const { versionA, versionB } = req.body;
  if (!versionA || !versionB) {
    return res.status(400).json({
      status: 'error',
      message: 'Both versionA and versionB are required to compute diff.',
      correlationId: req.correlationId
    });
  }

  const diff = snapshotService.compareSnapshots(versionA, versionB);
  res.json({
    status: 'success',
    diff,
    correlationId: req.correlationId
  });
});

/**
 * POST /api/dahab/admin/entities/resolve
 */
adminDahabRouter.post('/entities/resolve', (req: AuthenticatedRequest, res: Response) => {
  const { nameEn, nameAr, category, lat, lng, googlePlaceId } = req.body;
  if (!nameEn || lat === undefined || lng === undefined) {
    return res.status(400).json({
      status: 'error',
      message: 'nameEn, lat, and lng are required to resolve candidate entity.',
      correlationId: req.correlationId
    });
  }

  const result = entityResolutionService.resolveCandidate({
    nameEn,
    nameAr,
    category,
    lat,
    lng,
    googlePlaceId
  });

  res.json({
    status: 'success',
    candidate: { nameEn, nameAr, lat, lng },
    resolution: result,
    correlationId: req.correlationId
  });
});

/**
 * POST /api/dahab/admin/entities/merge
 */
adminDahabRouter.post('/entities/merge', (req: AuthenticatedRequest, res: Response) => {
  const { sourceId, targetId } = req.body;
  if (!sourceId || !targetId) {
    return res.status(400).json({
      status: 'error',
      message: 'Both sourceId and targetId are required for merge.',
      correlationId: req.correlationId
    });
  }

  const actor = req.user?.name || 'Operations Lead';
  const result = entityResolutionService.mergeEntities(sourceId, targetId, actor);

  res.json({
    status: 'success',
    ...result,
    correlationId: req.correlationId
  });
});

/**
 * GET /api/dahab/admin/stale-facts
 */
adminDahabRouter.get('/stale-facts', (req: AuthenticatedRequest, res: Response) => {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const stale = db.temporalFacts.filter(f => isFactStale(f, cutoff));

  res.json({
    status: 'success',
    count: stale.length,
    staleFacts: stale,
    correlationId: req.correlationId
  });
});

/**
 * GET /api/dahab/admin/logs
 * Search Observability query logs
 */
adminDahabRouter.get('/logs', (req: AuthenticatedRequest, res: Response) => {
  const limit = Number(req.query.limit) || 50;
  const logs = dahabKnowledgeOs.getSearchLogs(limit);

  res.json({
    status: 'success',
    count: logs.length,
    logs,
    correlationId: req.correlationId
  });
});

/**
 * POST /api/dahab/admin/proof
 * Execute 30-Point DKOS Live Product Proof Suite
 */
adminDahabRouter.post('/proof', (req: AuthenticatedRequest, res: Response) => {
  const proofResult = runDkosLiveProductProof();

  res.json({
    status: proofResult.certified ? 'success' : 'warning',
    ...proofResult,
    correlationId: req.correlationId
  });
});

/**
 * GET /api/dahab/admin/gaps
 * Automated Knowledge Gap Detection
 */
adminDahabRouter.get('/gaps', (req: AuthenticatedRequest, res: Response) => {
  const gaps = knowledgeGapService.detectKnowledgeGaps();
  res.json({
    status: 'success',
    count: gaps.length,
    gaps,
    correlationId: req.correlationId
  });
});

/**
 * GET /api/dahab/admin/expansion-metrics
 * Destination Coverage & Density Metrics Summary
 */
adminDahabRouter.get('/expansion-metrics', (req: AuthenticatedRequest, res: Response) => {
  const metrics = knowledgeGapService.getExpansionMetrics();
  res.json({
    status: 'success',
    metrics,
    correlationId: req.correlationId
  });
});

/**
 * GET /api/dahab/admin/review-queue
 * Human Operational Review Queue
 */
adminDahabRouter.get('/review-queue', (req: AuthenticatedRequest, res: Response) => {
  const queue = knowledgeGapService.getHumanReviewQueue();
  res.json({
    status: 'success',
    count: queue.length,
    queue,
    correlationId: req.correlationId
  });
});

/**
 * POST /api/dahab/admin/review-queue/resolve
 * Resolve human review item
 */
adminDahabRouter.post('/review-queue/resolve', (req: AuthenticatedRequest, res: Response) => {
  const { reviewId, decision, notes } = req.body;
  if (!reviewId || !decision) {
    return res.status(400).json({
      status: 'error',
      message: 'reviewId and decision (APPROVE | REJECT | REQUEST_MORE_INFO) are required',
      correlationId: req.correlationId
    });
  }

  const reviewer = req.user?.name || 'Operations Lead';
  const result = knowledgeGapService.resolveHumanReviewItem(reviewId, decision, notes || '', reviewer);

  res.json({
    status: result.success ? 'success' : 'error',
    message: result.message,
    item: result.item,
    correlationId: req.correlationId
  });
});

/**
 * POST /api/dahab/admin/stage-observation
 * Stage a new observation without polluting authoritative state
 */
adminDahabRouter.post('/stage-observation', (req: AuthenticatedRequest, res: Response) => {
  const obs = knowledgeGapService.stageObservation(req.body);
  res.json({
    status: 'success',
    observation: obs,
    correlationId: req.correlationId
  });
});

/**
 * POST /api/dahab/admin/promote-observation
 * Promote a staged observation to live temporal facts after validation
 */
adminDahabRouter.post('/promote-observation', (req: AuthenticatedRequest, res: Response) => {
  const { observationId } = req.body;
  if (!observationId) {
    return res.status(400).json({
      status: 'error',
      message: 'observationId is required',
      correlationId: req.correlationId
    });
  }

  const actor = req.user?.name || 'Operations Lead';
  const result = knowledgeGapService.promoteObservation(observationId, actor);
  res.json({
    status: result.success ? 'success' : 'error',
    error: result.error,
    placeId: result.placeId,
    correlationId: req.correlationId
  });
});


