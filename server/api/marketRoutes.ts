/**
 * DEPRECATED: use /api/dahab/commerce/* — this router mirrors dahabRoutes and will be removed.
 * Canonical implementation: server/api/dahabRoutes.ts (commerce/* + autonomous ops).
 * TODO: remove /api/market mount in server.ts once clients migrate — keep until then to avoid 404 regression.
 */
import { Router } from 'express';
import { marketFreshnessService } from '../services/marketFreshnessService';
import { autonomousDataOpsService } from '../services/autonomousDataOpsService';
import {
  stringParam,
  enumParam,
  REVIEW_ISSUE_TYPES,
  REVIEW_STATUSES,
  SEVERITIES
} from '../middleware/queryParams';

export const marketRouter = Router();

// Deprecation: mirror of dahabRoutes — emit warning + header for existing clients.
marketRouter.use((req, res, next) => {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', 'Thu, 31 Dec 2026 23:59:59 GMT');
  res.setHeader('X-Deprecated-Use', '/api/dahab/commerce/*');
  console.warn(`[DEPRECATED] ${req.method} ${req.originalUrl} — use /api/dahab/commerce/* (canonical: server/api/dahabRoutes.ts)`);
  next();
});

// Schedule policies
marketRouter.get('/jobs', (_req, res) => {
  const policies = autonomousDataOpsService.getSchedulePolicies();
  res.json({ status: 'success', count: policies.length, policies });
});

marketRouter.post('/jobs/trigger', async (req, res) => {
  try {
    const { sourceId, force } = req.body || {};
    if (!sourceId) return res.status(400).json({ error: 'sourceId is required' });
    const result = await autonomousDataOpsService.triggerScheduledRefresh(sourceId, force === true);
    res.json({ status: 'success', result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

marketRouter.post('/jobs/policy', (req, res) => {
  try {
    const { sourceId, ...updates } = req.body || {};
    if (!sourceId) return res.status(400).json({ error: 'sourceId is required' });
    const updated = autonomousDataOpsService.updateSchedulePolicy(sourceId, updates);
    res.json({ status: 'success', policy: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Source health
marketRouter.get('/sources/health', (_req, res) => {
  const health = marketFreshnessService.getSourceHealthReport();
  res.json({ status: 'success', count: health.length, health });
});

marketRouter.post('/sources/circuit-breaker/reset', (req, res) => {
  try {
    const { sourceReference } = req.body || {};
    if (!sourceReference) return res.status(400).json({ error: 'sourceReference is required' });
    const health = autonomousDataOpsService.resetCircuitBreaker(sourceReference);
    res.json({ status: 'success', health });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Review queue
marketRouter.get('/review-queue', (req, res) => {
  const items = marketFreshnessService.getReviewQueue({
    issueType: enumParam(req.query.issueType, REVIEW_ISSUE_TYPES, 'issueType'),
    status: enumParam(req.query.status, REVIEW_STATUSES, 'status'),
    severity: enumParam(req.query.severity, SEVERITIES, 'severity')
  });
  res.json({ status: 'success', count: items.length, items });
});

marketRouter.post('/review-queue/:id/resolve', (req, res) => {
  try {
    const { action, notes, reviewer } = req.body || {};
    const item = marketFreshnessService.resolveReviewQueueItem({
      id: req.params.id,
      action: action || 'APPROVED',
      notes,
      reviewer
    });
    res.json({ status: 'success', item });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Operations overview
marketRouter.get('/ops/overview', (_req, res) => {
  const overview = marketFreshnessService.getOperationsMarketOverview();
  res.json({ status: 'success', overview });
});

marketRouter.post('/ops/run-all', async (_req, res) => {
  try {
    const results = await autonomousDataOpsService.runAllScheduledJobs();
    res.json({ status: 'success', totalRuns: results.length, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Alerts
marketRouter.get('/alerts', (req, res) => {
  const alerts = autonomousDataOpsService.getAlerts({
    status: stringParam(req.query.status, 'status'),
    severity: enumParam(req.query.severity, SEVERITIES, 'severity')
  });
  res.json({ status: 'success', count: alerts.length, alerts });
});

marketRouter.post('/alerts/:id/acknowledge', (req, res) => {
  try {
    const { acknowledgedBy } = req.body || {};
    const alert = autonomousDataOpsService.acknowledgeAlert(req.params.id, acknowledgedBy);
    res.json({ status: 'success', alert });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

marketRouter.post('/alerts/:id/resolve', (req, res) => {
  try {
    const { resolutionNotes } = req.body || {};
    const alert = autonomousDataOpsService.resolveAlert(req.params.id, resolutionNotes);
    res.json({ status: 'success', alert });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Snapshots
marketRouter.get('/snapshots', (req, res) => {
  const limit = Number(req.query.limit) || 10;
  const snapshots = autonomousDataOpsService.getSnapshots(limit);
  res.json({ status: 'success', count: snapshots.length, snapshots });
});

marketRouter.post('/snapshots/create', (req, res) => {
  try {
    const { reason, createdBy } = req.body || {};
    const snapshot = autonomousDataOpsService.createSnapshot(reason, createdBy);
    res.json({ status: 'success', snapshot });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

marketRouter.post('/snapshots/:id/rollback', (req, res) => {
  try {
    const { executedBy } = req.body || {};
    const result = autonomousDataOpsService.rollbackToSnapshot(req.params.id, executedBy);
    res.json({ status: 'success', result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Status
marketRouter.get('/status', (_req, res) => {
  const status = autonomousDataOpsService.getAutonomousStatus();
  res.json({ status: 'success', ...status });
});

// Events & trends
marketRouter.get('/events', (req, res) => {
  const events = marketFreshnessService.getMarketChangeEvents({
    supplierId: stringParam(req.query.supplierId, 'supplierId'),
    activityId: stringParam(req.query.activityId, 'activityId'),
    limit: Number(stringParam(req.query.limit, 'limit') ?? 20)
  });
  res.json({ status: 'success', count: events.length, events });
});

marketRouter.get('/price-history', (req, res) => {
  const observations = marketFreshnessService.getPriceHistory({
    activityId: stringParam(req.query.activityId, 'activityId'),
    supplierId: stringParam(req.query.supplierId, 'supplierId'),
    limit: Number(stringParam(req.query.limit, 'limit') ?? 50)
  });
  res.json({ status: 'success', count: observations.length, observations });
});

marketRouter.get('/trends', (req, res) => {
  const trends = marketFreshnessService.getMarketTrends({
    activityId: stringParam(req.query.activityId, 'activityId'),
    category: stringParam(req.query.category, 'category')
  });
  res.json({ status: 'success', ...trends });
});

// Source freshness
marketRouter.get('/source-freshness', (_req, res) => {
  const report = marketFreshnessService.getSourceFreshnessReport();
  res.json({ status: 'success', ...report });
});

// Refresh
marketRouter.post('/refresh', (req, res) => {
  try {
    const result = marketFreshnessService.executeMarketRefresh(req.body || {});
    res.json({
      ...result,
      status: result.success ? 'success' : 'error',
      refreshStatus: result.status
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
