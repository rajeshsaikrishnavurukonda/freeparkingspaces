import { ParkingSpot, ParkingSpotType, FreeConditions, WeekdayOrHoliday } from '../../shared/types/parkingSpot';
import { OverpassElement, queryOverpass } from './overpassClient';
import { cache } from '../cache/inMemoryCacheProvider';
import { env } from '../../config/env';

export function parseMaxStayMinutes(raw: string | undefined): number | null {
  if (!raw) return null;
  const hourMatch = raw.match(/(\d+(?:\.\d+)?)\s*h/i);
  if (hourMatch) return Math.round(parseFloat(hourMatch[1]) * 60);
  const minMatch = raw.match(/(\d+)\s*min/i);
  if (minMatch) return parseInt(minMatch[1], 10);
  return null;
}

type OnStreetStatus = 'explicit-free' | 'restricted' | 'presumed-free' | 'none';

/**
 * Classifies an on-street way's parking freedom. An explicit
 * parking:condition=free tag is rare in OSM — most UK on-street mapping only
 * bothers tagging *restrictions* (permit holders, no_parking, etc.), not the
 * absence of one. So a marked bay (parking:lane:*) with no condition tag at
 * all is treated as "presumed free" rather than excluded, since that's the
 * far more common real-world pattern for genuinely unrestricted streets —
 * callers must surface this with a clear caveat, not the same certainty as
 * an explicit tag.
 */
function classifyOnStreetStatus(tags: Record<string, string>): OnStreetStatus {
  const conditionValues = ['parking:condition:both', 'parking:condition:left', 'parking:condition:right']
    .map((key) => tags[key])
    .filter((v): v is string => Boolean(v));
  const laneValues = ['parking:lane:both', 'parking:lane:left', 'parking:lane:right']
    .map((key) => tags[key])
    .filter((v): v is string => Boolean(v));

  if (conditionValues.some((v) => v.toLowerCase().includes('free'))) return 'explicit-free';
  if (conditionValues.length > 0) return 'restricted';
  if (laneValues.some((v) => !['no', 'none'].includes(v.toLowerCase()))) return 'presumed-free';
  return 'none';
}

const OSM_DAY_MAP: Record<string, WeekdayOrHoliday> = {
  Mo: 'Mon',
  Tu: 'Tue',
  We: 'Wed',
  Th: 'Thu',
  Fr: 'Fri',
  Sa: 'Sat',
  Su: 'Sun',
  PH: 'PublicHoliday',
};
const DAY_ORDER = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function expandDayToken(token: string): WeekdayOrHoliday[] {
  if (token === 'PH') return ['PublicHoliday'];

  const rangeMatch = token.match(/^([A-Za-z]{2})-([A-Za-z]{2})$/);
  if (rangeMatch) {
    const startIdx = DAY_ORDER.indexOf(rangeMatch[1]);
    const endIdx = DAY_ORDER.indexOf(rangeMatch[2]);
    if (startIdx === -1 || endIdx === -1) return [];
    const days: WeekdayOrHoliday[] = [];
    for (let i = startIdx; ; i = (i + 1) % 7) {
      days.push(OSM_DAY_MAP[DAY_ORDER[i]]);
      if (i === endIdx) break;
    }
    return days;
  }

  const single = OSM_DAY_MAP[token];
  return single ? [single] : [];
}

export interface ParsedFeeConditional {
  freeAfter: string | null;
  freeBefore: string | null;
  freeDays: WeekdayOrHoliday[] | null;
}

/**
 * Parses OSM `fee:conditional` values, e.g. "no @ (Su,PH)" or "no @ (18:00-08:00)".
 * Only extracts clauses where the value is "no" (free). A same-day time window
 * (e.g. 09:00-17:00) means "free only between" which freeAfter/freeBefore can't
 * represent without misleading users, so that case is left unparsed rather than guessed.
 */
export function parseFeeConditional(raw: string): ParsedFeeConditional | null {
  const clauses = raw.split(';').map((c) => c.trim());

  for (const clause of clauses) {
    const atIndex = clause.indexOf('@');
    if (atIndex === -1) continue;

    const value = clause.slice(0, atIndex).trim().toLowerCase();
    if (value !== 'no') continue;

    const condition = clause
      .slice(atIndex + 1)
      .trim()
      .replace(/^\(|\)$/g, '');

    const timeMatch = condition.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
    const dayTokens = condition
      .replace(/\d{2}:\d{2}\s*-\s*\d{2}:\d{2}/, '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const freeDays = dayTokens.flatMap(expandDayToken);

    if (timeMatch) {
      const [, start, end] = timeMatch;
      if (start > end) {
        return { freeAfter: start, freeBefore: end, freeDays: freeDays.length ? freeDays : null };
      }
      return null;
    }

    if (freeDays.length) {
      return { freeAfter: null, freeBefore: null, freeDays };
    }
  }

  return null;
}

export function buildFreeConditions(tags: Record<string, string>): FreeConditions {
  const fee = tags['fee'];
  const feeConditional = tags['fee:conditional'];
  const onStreetStatus = classifyOnStreetStatus(tags);
  const alwaysFree = fee === 'no' || onStreetStatus === 'explicit-free' || onStreetStatus === 'presumed-free';
  const parsed = feeConditional ? parseFeeConditional(feeConditional) : null;

  const notesParts: string[] = [];
  if (feeConditional) notesParts.push(`Restriction (raw OSM tag): ${feeConditional}`);
  if (onStreetStatus === 'presumed-free') {
    notesParts.push('No parking restriction found in OpenStreetMap for this street — likely free, but not confirmed. Always check signage.');
  }

  return {
    alwaysFree,
    freeAfter: parsed?.freeAfter ?? null,
    freeBefore: parsed?.freeBefore ?? null,
    freeDays: parsed?.freeDays ?? null,
    maxStayMinutes: parseMaxStayMinutes(tags['maxstay']),
    notes: notesParts.length ? notesParts.join(' ') : null,
  };
}

export function classifyType(tags: Record<string, string>): ParkingSpotType {
  if (tags['amenity'] === 'parking') return 'car_park';
  if (tags['highway'] && classifyOnStreetStatus(tags) !== 'none') return 'on_street_bay';
  return 'unknown';
}

function hasFreeSignal(fc: FreeConditions): boolean {
  return fc.alwaysFree || Boolean(fc.freeAfter) || Boolean(fc.freeBefore) || Boolean(fc.freeDays?.length);
}

export function elementToSpot(el: OverpassElement): ParkingSpot | null {
  const tags = el.tags || {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat === undefined || lng === undefined) return null;

  return {
    id: `osm-${el.type}-${el.id}`,
    name: tags['name'] || null,
    lat,
    lng,
    type: classifyType(tags),
    address: tags['addr:street'] ? `${tags['addr:housenumber'] ?? ''} ${tags['addr:street']}`.trim() : null,
    council: null,
    freeConditions: buildFreeConditions(tags),
    capacity: tags['capacity'] ? parseInt(tags['capacity'], 10) || null : null,
    source: 'osm',
    sourceDetail: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    confidence: 'baseline',
    lastVerified: new Date().toISOString(),
  };
}

function geohashCacheKey(lat: number, lng: number, radius: number): string {
  return `osm:${lat.toFixed(3)},${lng.toFixed(3)}:${radius}`;
}

export async function fetchOsmParkingSpots(lat: number, lng: number, radiusMeters: number): Promise<ParkingSpot[]> {
  const key = geohashCacheKey(lat, lng, radiusMeters);
  const cached = cache.get<ParkingSpot[]>(key);
  if (cached) return cached;

  const elements = await queryOverpass(lat, lng, radiusMeters);
  const spots = elements.map(elementToSpot).filter((s): s is ParkingSpot => s !== null && hasFreeSignal(s.freeConditions));

  cache.set(key, spots, env.osmCacheTtlSeconds);
  return spots;
}
