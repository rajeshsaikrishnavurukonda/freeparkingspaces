import { GeocodedLocation, GeocodePrecision } from '../../shared/types/geocodedLocation';

const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
const UK_OUTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?$/i;
// Sector: outcode + sector digit, e.g. "AB12 8" or "AB128" — a subdivision of
// a district, smaller than an outcode but far less precise than a full
// postcode. Subsector: sector + first unit letter, e.g. "AB12 8S" — narrower
// still. Neither has a dedicated postcodes.io endpoint, so both are resolved
// via autocomplete + bulk lookup (see below) rather than a single fetch.
const UK_SECTOR_REGEX = /^([A-Z]{1,2}\d[A-Z\d]?)\s*(\d)$/i;
const UK_SUBSECTOR_REGEX = /^([A-Z]{1,2}\d[A-Z\d]?)\s*(\d)([A-Z])$/i;

export type PostcodeInputKind = GeocodePrecision | 'none';

export function classifyPostcodeInput(input: string): PostcodeInputKind {
  const trimmed = input.trim();
  // Outcode must be checked before sector: a 4-character unspaced input like
  // "BH17" is structurally ambiguous between the complete outcode "BH17" and
  // outcode "BH1" + sector digit "7" (regex backtracking would otherwise pick
  // the latter). A user typing no space virtually always means the former.
  if (UK_POSTCODE_REGEX.test(trimmed)) return 'postcode';
  if (UK_OUTCODE_REGEX.test(trimmed)) return 'outcode';
  if (UK_SUBSECTOR_REGEX.test(trimmed)) return 'subsector';
  if (UK_SECTOR_REGEX.test(trimmed)) return 'sector';
  return 'none';
}

export function looksLikePostcode(input: string): boolean {
  return classifyPostcodeInput(input) !== 'none';
}

interface PostcodesIoResult {
  latitude: number;
  longitude: number;
  postcode?: string;
  outcode?: string;
  admin_district?: string | string[] | null;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://api.postcodes.io${path}`, { ...init, signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function pickAdminDistrict(value: string | string[] | null | undefined): string | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

async function geocodeExact(trimmed: string, isFullPostcode: boolean): Promise<GeocodedLocation | null> {
  const path = isFullPostcode ? `/postcodes/${encodeURIComponent(trimmed)}` : `/outcodes/${encodeURIComponent(trimmed)}`;
  const json = await fetchJson<{ result: PostcodesIoResult }>(path);
  const result = json?.result;
  if (!result) return null;

  return {
    lat: result.latitude,
    lng: result.longitude,
    label: result.postcode || result.outcode || trimmed.toUpperCase(),
    postcode: result.postcode ?? null,
    adminDistrict: pickAdminDistrict(result.admin_district),
    source: 'postcodes.io',
    precision: isFullPostcode ? 'postcode' : 'outcode',
  };
}

/**
 * Resolves a postcode sector ("AB12 8") or subsector ("AB12 8S") by finding
 * real postcodes under that prefix (autocomplete) and averaging their
 * coordinates (bulk lookup) — postcodes.io has no dedicated endpoint for
 * these intermediate precision levels, unlike full postcodes and outcodes.
 */
async function geocodeSectorOrSubsector(trimmed: string, precision: 'sector' | 'subsector'): Promise<GeocodedLocation | null> {
  const prefixNoSpace = trimmed.replace(/\s+/g, '').toUpperCase();

  const autocomplete = await fetchJson<{ result: string[] | null }>(`/postcodes/${encodeURIComponent(prefixNoSpace)}/autocomplete?limit=20`);
  const matches = autocomplete?.result ?? [];
  if (matches.length === 0) return null;

  const bulk = await fetchJson<{ result: { query: string; result: PostcodesIoResult | null }[] }>('/postcodes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postcodes: matches }),
  });
  const resolved = (bulk?.result ?? []).map((r) => r.result).filter((r): r is PostcodesIoResult => r !== null);
  if (resolved.length === 0) return null;

  const lat = resolved.reduce((sum, r) => sum + r.latitude, 0) / resolved.length;
  const lng = resolved.reduce((sum, r) => sum + r.longitude, 0) / resolved.length;

  return {
    lat,
    lng,
    label: `${trimmed.toUpperCase()} area (${resolved.length} postcodes averaged)`,
    postcode: null,
    adminDistrict: pickAdminDistrict(resolved[0].admin_district),
    source: 'postcodes.io',
    precision,
  };
}

export async function geocodeWithPostcodesIo(input: string): Promise<GeocodedLocation | null> {
  const trimmed = input.trim();
  const kind = classifyPostcodeInput(trimmed);

  switch (kind) {
    case 'postcode':
      return geocodeExact(trimmed, true);
    case 'outcode':
      return geocodeExact(trimmed, false);
    case 'sector':
    case 'subsector':
      return geocodeSectorOrSubsector(trimmed, kind);
    default:
      return null;
  }
}
