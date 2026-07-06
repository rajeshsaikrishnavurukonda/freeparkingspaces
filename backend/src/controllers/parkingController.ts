import { Request, Response, NextFunction } from 'express';
import { searchFreeParking, LocationNotFoundError } from '../services/search/searchOrchestrator';

const MAX_RADIUS = 6000;
const DEFAULT_LIMIT = 50;

export async function searchParkingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const location = typeof req.query.location === 'string' ? req.query.location.trim() : '';
    if (!location) {
      return res.status(400).json({ error: 'MISSING_LOCATION', message: 'Query param "location" is required.' });
    }

    // No default applied here: an outcode or place-name search should use a
    // wider radius than a full postcode, which the orchestrator decides once
    // it knows how precise the geocoded location actually is. Only clamp an
    // explicitly-requested radius here.
    const rawRadius = req.query.radius !== undefined ? parseInt(String(req.query.radius), 10) : undefined;
    const requestedRadius = Number.isFinite(rawRadius) && rawRadius! > 0 ? Math.min(MAX_RADIUS, Math.max(50, rawRadius!)) : undefined;
    const limit = Math.max(1, parseInt(String(req.query.limit ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT);

    const result = await searchFreeParking(location, requestedRadius, limit);
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof LocationNotFoundError) {
      return res.status(422).json({
        error: 'LOCATION_NOT_FOUND',
        message: 'We could not find that location. Try a full UK postcode or a more specific place name.',
      });
    }
    next(err);
  }
}
