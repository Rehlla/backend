/**
 * /api/weather/:citySlug — current conditions for a seeded city
 * (report 04 §12; gap C-4 of 11).
 *
 * Coordinates come from the city registry (cityRecord.cityCenter), so no
 * per-city weather table is duplicated here; the three named constants in
 * WEATHER_LOCATIONS were absorbed as their seed twins. Null upstream answers
 * 503 with an explanation — never a fabricated reading.
 */
import { Router, Request, Response } from 'express';
import { weatherService } from '../services/weatherService';
import { cityCenter, findCitySeed, swFrom } from '../services/cityRecord';

export const weatherRouter = Router();

weatherRouter.get('/:citySlug', async (req: Request, res: Response) => {
  const slug = String(req.params.citySlug || '').trim().toLowerCase();
  const seed = findCitySeed(slug);
  if (!seed) return res.status(404).json({ error: 'City not found', city: slug });

  const coords = cityCenter(seed);
  const conditions = await weatherService.getCurrentConditionsAt(coords);
  if (!conditions) {
    return res.status(503).json({
      error: 'conditions_unavailable',
      city: slug,
      source: 'Open-Meteo',
      observedAt: new Date().toISOString(),
    });
  }

  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json({
    city: slug,
    coords,
    kind: seed.kind ?? 'sea',
    // Inland cities surface air, wind and sunset only — waterTemperatureC
    // comes back null for them and the profile says so up front.
    profile: { kind: seed.kind && seed.kind !== 'sea' ? 'air' : 'sea' },
    sw: swFrom(seed),
    conditions,
  });
});
