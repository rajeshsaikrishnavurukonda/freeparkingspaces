import { ParkingSpot } from '../../shared/types/parkingSpot';
import { SearchResponse } from '../../shared/types/searchResponse';
import { GeocodePrecision, GeocodedLocation } from '../../shared/types/geocodedLocation';
import { geocodeLocation } from '../geocoding/geocodingService';
import { fetchOsmParkingSpots } from '../osm/osmParkingAdapter';
import { getAdapterForCouncil } from '../councilAdapters/registry';
import { CouncilAdapter, RawCouncilPayload } from '../councilAdapters/types';
import { mergeSpots } from '../merge/spotMerger';
import { cache } from '../cache/inMemoryCacheProvider';
import { env } from '../../config/env';
import { haversineMeters } from '../../utils/geo';

export class LocationNotFoundError extends Error {}

// Anything coarser than a full postcode resolves to one centroid point
// covering a much larger real-world area — searching with a postcode-sized
// radius around that point misses most of the area the user actually meant,
// so the default radius widens with how coarse the geocode is unless the
// caller explicitly requests a specific radius.
const DEFAULT_RADIUS_BY_PRECISION: Record<GeocodePrecision, number> = {
  postcode: 500,
  subsector: 1000,
  sector: 1800,
  place: 1500,
  outcode: 3000,
};

// A full postcode's centroid is often not exactly where a user is standing,
// and OSM parking coverage is patchy — a search that finds genuinely zero
// results at the tight default radius doesn't mean there's no parking
// nearby, just that the default was too small for this particular spot. Each
// rung is independently cached by radius (see resultCacheKey), so retrying
// this ladder on a later identical search is fast once warm.
const MAX_ESCALATION_RADIUS_METERS = 6000;

function buildEscalationLadder(baseRadius: number): number[] {
  const ladder = [baseRadius];
  let next = baseRadius * 2;
  while (next <= MAX_ESCALATION_RADIUS_METERS && ladder.length < 3) {
    ladder.push(next);
    next *= 2;
  }
  return ladder;
}

// A result with warnings means a source failed (likely transient — rate
// limiting, a slow endpoint) rather than "genuinely nothing here". Caching
// that for the full result TTL would keep serving a stale empty/partial
// result well after the underlying source recovers, so degraded results get
// a much shorter TTL than a clean, fully-successful one.
const DEGRADED_RESULT_CACHE_TTL_SECONDS = 30;

interface CachedSearchResult {
  spots: ParkingSpot[];
  sourcesUsed: string[];
  warnings: string[];
  notes?: string;
}

function resultCacheKey(lat: number, lng: number, radius: number): string {
  return `search:${lat.toFixed(3)},${lng.toFixed(3)}:${radius}`;
}

/**
 * Fetches a council adapter's raw payload, caching it by councilId for
 * refreshIntervalMs so repeated searches near the same council don't re-hit
 * the source (or re-run AI normalization) on every request.
 */
async function getCouncilSpots(adapter: CouncilAdapter): Promise<ParkingSpot[]> {
  const rawCacheKey = `raw-payload:${adapter.councilId}`;
  let raw = cache.get<RawCouncilPayload>(rawCacheKey);
  if (!raw) {
    raw = await adapter.fetchRaw();
    cache.set(rawCacheKey, raw, Math.floor(adapter.refreshIntervalMs / 1000));
  }
  return adapter.normalize(raw);
}

export async function searchFreeParking(
  locationInput: string,
  requestedRadiusMeters: number | undefined,
  limit: number,
): Promise<SearchResponse> {
  const resolvedLocation = await geocodeLocation(locationInput);
  if (!resolvedLocation) {
    throw new LocationNotFoundError(`Could not resolve location: ${locationInput}`);
  }

  if (requestedRadiusMeters !== undefined) {
    return searchAtRadius(locationInput, resolvedLocation, requestedRadiusMeters, limit);
  }

  const ladder = buildEscalationLadder(DEFAULT_RADIUS_BY_PRECISION[resolvedLocation.precision]);
  let lastResult: SearchResponse | null = null;
  for (const radius of ladder) {
    lastResult = await searchAtRadius(locationInput, resolvedLocation, radius, limit);
    if (lastResult.spots.length > 0) return lastResult;
  }
  return lastResult!;
}

async function searchAtRadius(
  locationInput: string,
  resolvedLocation: GeocodedLocation,
  radiusMeters: number,
  limit: number,
): Promise<SearchResponse> {
  const cacheKey = resultCacheKey(resolvedLocation.lat, resolvedLocation.lng, radiusMeters);
  const cachedSpots = cache.get<CachedSearchResult>(cacheKey);

  if (cachedSpots) {
    return {
      query: { location: locationInput, radius: radiusMeters },
      resolvedLocation,
      spots: cachedSpots.spots.slice(0, limit),
      meta: {
        sourcesUsed: cachedSpots.sourcesUsed,
        councilAdapterAvailable: Boolean(getAdapterForCouncil(resolvedLocation.adminDistrict)),
        cacheHit: true,
        generatedAt: new Date().toISOString(),
        notes: cachedSpots.notes,
        warnings: cachedSpots.warnings.length ? cachedSpots.warnings : undefined,
      },
    };
  }

  const sourcesUsed: string[] = [];
  const warnings: string[] = [];
  const spotLists: ParkingSpot[][] = [];

  const adapter = getAdapterForCouncil(resolvedLocation.adminDistrict);

  const [osmResult, councilResult] = await Promise.allSettled([
    fetchOsmParkingSpots(resolvedLocation.lat, resolvedLocation.lng, radiusMeters),
    adapter ? getCouncilSpots(adapter) : Promise.resolve<ParkingSpot[]>([]),
  ]);

  if (osmResult.status === 'fulfilled') {
    spotLists.push(osmResult.value);
    sourcesUsed.push('osm');
  } else {
    console.error('OSM fetch failed:', osmResult.reason);
    warnings.push('OSM data temporarily unavailable');
  }

  if (adapter) {
    if (councilResult.status === 'fulfilled' && councilResult.value.length > 0) {
      spotLists.push(councilResult.value);
      sourcesUsed.push(adapter.councilId);
    } else if (councilResult.status === 'rejected') {
      console.error(`${adapter.displayName} fetch failed:`, councilResult.reason);
      warnings.push(`${adapter.displayName} data temporarily unavailable`);
    }
  }

  // Council adapters may return data for a whole borough, not just the search
  // radius (fetchRaw/normalize results are cached and reused across searches),
  // so results must be distance-filtered and sorted here regardless of source.
  const merged = mergeSpots(...spotLists)
    .map((spot) => ({ spot, distance: haversineMeters(resolvedLocation.lat, resolvedLocation.lng, spot.lat, spot.lng) }))
    .filter(({ distance }) => distance <= radiusMeters)
    .sort((a, b) => a.distance - b.distance)
    .map(({ spot }) => spot);

  const notes = merged.length === 0 ? 'No known free parking data for this area yet.' : undefined;
  const cacheTtl = warnings.length > 0 ? DEGRADED_RESULT_CACHE_TTL_SECONDS : env.searchResultCacheTtlSeconds;
  cache.set(cacheKey, { spots: merged, sourcesUsed, warnings, notes }, cacheTtl);

  return {
    query: { location: locationInput, radius: radiusMeters },
    resolvedLocation,
    spots: merged.slice(0, limit),
    meta: {
      sourcesUsed,
      councilAdapterAvailable: Boolean(adapter),
      cacheHit: false,
      generatedAt: new Date().toISOString(),
      notes,
      warnings: warnings.length ? warnings : undefined,
    },
  };
}
