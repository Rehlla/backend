import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/correlationMiddleware';
import { enumParam, stringParam } from '../middleware/queryParams';
import {
  buildRemoteConfig,
  CONFIG_PLATFORMS,
  type ConfigPlatform,
} from '../services/remoteConfigService';

/**
 * GET /api/config — unified remote config (docs/OPS_API_CONTRACT.md).
 *
 * Public on purpose: anonymous visitors need maintenance state, kill
 * switches and the announcement banner before they ever sign in, and the
 * payload only contains client-safe values (see remoteConfigService.ts for
 * what is deliberately excluded). Signed-in callers get feature flags
 * evaluated for their own role/rollout bucket.
 *
 * Query:
 *   platform=web|android|ios (default web) — selects which app gate applies.
 *   appVersion=1.2.3 (optional) — enables updateRequired/updateAvailable.
 *
 * Caching: the response carries `version` plus an ETag over the serialized
 * body; clients polling on boot send If-None-Match and get a 304 while
 * nothing changed (same convention as /api/operations/overview).
 */
export const configRouter = Router();

configRouter.get('/', (req: AuthenticatedRequest, res) => {
  const platform =
    enumParam(req.query.platform, CONFIG_PLATFORMS, 'platform') ?? ('web' as ConfigPlatform);
  const appVersion = stringParam(req.query.appVersion, 'appVersion');

  const config = buildRemoteConfig({
    user: req.user ? { userId: req.user.userId, role: req.user.role } : null,
    platform,
    appVersion,
  });

  // The ETag is the content version (not a hash of the serialized body: the
  // body carries issuedAt, which changes on every read and would make the
  // tag useless). Identical control state answers 304.
  const etag = `"${config.version}"`;
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'public, max-age=60');

  const inm = req.header('if-none-match');
  if (inm && inm.split(',').map(s => s.trim()).some(t => t === etag || t === `W/${etag}` || t === '*')) {
    return res.status(304).end();
  }
  res.json(config);
});
