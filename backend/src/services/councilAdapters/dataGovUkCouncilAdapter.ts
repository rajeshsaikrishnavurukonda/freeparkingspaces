import crypto from 'crypto';
import { CouncilAdapter, RawCouncilPayload, RawContentType } from './types';
import { ParkingSpot } from '../../shared/types/parkingSpot';
import { parseTabularRows } from '../../utils/parseTabularRows';
import { isWithinUkBounds, coordinateMatchesRow } from '../../utils/coordinateValidation';
import { normalizeGenericRows } from '../aiNormalization/normalizeParkingData';

const USER_AGENT = 'uk-free-parking-finder/0.1 (contact: rajesh.saikrishna@gmail.com)';
const CKAN_SEARCH_URL = 'https://ckan.publishing.service.gov.uk/api/3/action/package_search';
const SUPPORTED_FORMATS: Record<string, RawContentType> = { CSV: 'csv', JSON: 'json', GEOJSON: 'geojson' };
const MAX_ROWS_FOR_AI = 300;
const BATCH_SIZE = 20;
const EMPTY_PAYLOAD_MARKER = '__no_dataset_found__';

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

interface CkanResource {
  format: string;
  url: string;
}

interface CkanDataset {
  title: string;
  organization?: { title?: string };
  resources: CkanResource[];
}

async function findCouncilParkingDataset(councilName: string): Promise<{ dataset: CkanDataset; resource: CkanResource } | null> {
  const url = new URL(CKAN_SEARCH_URL);
  url.searchParams.set('q', `parking ${councilName}`);
  url.searchParams.set('rows', '20');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url.toString(), { headers: { 'User-Agent': USER_AGENT }, signal: controller.signal });
    if (!res.ok) return null;

    const json = (await res.json()) as { result?: { results?: CkanDataset[] } };
    const datasets = json.result?.results ?? [];
    const normalizedCouncil = councilName.toLowerCase();

    for (const dataset of datasets) {
      const orgMatches = (dataset.organization?.title || '').toLowerCase().includes(normalizedCouncil);
      if (!orgMatches) continue;

      const resource = dataset.resources.find((r) => SUPPORTED_FORMATS[(r.format || '').toUpperCase()]);
      if (resource) return { dataset, resource };
    }

    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function emptyPayload(reasonKey: string, sourceUrl: string): RawCouncilPayload {
  return {
    contentType: 'json',
    body: EMPTY_PAYLOAD_MARKER,
    fetchedAt: new Date().toISOString(),
    contentHash: sha256(reasonKey),
    sourceUrl,
  };
}

async function fetchRaw(councilName: string): Promise<RawCouncilPayload> {
  const found = await findCouncilParkingDataset(councilName);
  if (!found) {
    return emptyPayload(`${councilName}:no-dataset`, CKAN_SEARCH_URL);
  }

  const { dataset, resource } = found;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    // CKAN catalog metadata for older/legacy resources is frequently stale
    // (broken links, dead subdomains, connection failures) — this is common
    // enough (observed live for multiple real councils) that it isn't worth
    // surfacing as a transient "temporarily unavailable" warning; treat any
    // failure to retrieve the discovered resource the same as no dataset found.
    const res = await fetch(resource.url, { headers: { 'User-Agent': USER_AGENT }, signal: controller.signal });
    if (!res.ok) {
      console.warn(`${councilName}: found a dataset via data.gov.uk but its resource link is broken (HTTP ${res.status}).`);
      return emptyPayload(`${councilName}:broken-resource`, resource.url);
    }
    const body = await res.text();

    return {
      contentType: SUPPORTED_FORMATS[resource.format.toUpperCase()],
      body,
      fetchedAt: new Date().toISOString(),
      contentHash: sha256(body),
      sourceUrl: resource.url,
      datasetTitle: dataset.title,
    };
  } catch (err) {
    console.warn(`${councilName}: found a dataset via data.gov.uk but failed to download its resource:`, err);
    return emptyPayload(`${councilName}:unreachable-resource`, resource.url);
  } finally {
    clearTimeout(timeout);
  }
}

async function normalize(raw: RawCouncilPayload, councilName: string): Promise<ParkingSpot[]> {
  if (raw.body === EMPTY_PAYLOAD_MARKER) return [];

  let rawRows: Record<string, unknown>[];
  try {
    rawRows = parseTabularRows(raw.body, raw.contentType as 'csv' | 'json' | 'geojson');
  } catch (err) {
    console.error(`Failed to parse dataset for ${councilName}:`, err);
    return [];
  }

  if (rawRows.length === 0) return [];

  const rowsForAi = rawRows.slice(0, MAX_ROWS_FOR_AI);
  if (rawRows.length > MAX_ROWS_FOR_AI) {
    console.warn(`${councilName}: dataset has ${rawRows.length} rows, only processing first ${MAX_ROWS_FOR_AI} for cost containment.`);
  }

  const spots: ParkingSpot[] = [];
  const datasetTitle = raw.datasetTitle || 'Council parking dataset';

  for (let i = 0; i < rowsForAi.length; i += BATCH_SIZE) {
    const batch = rowsForAi.slice(i, i + BATCH_SIZE);
    const batchHash = sha256(JSON.stringify(batch));
    const normalizedRows = await normalizeGenericRows(batch, datasetTitle, councilName, batchHash);

    for (const normalized of normalizedRows) {
      if (!normalized.isParkingLocation || !normalized.hasFreeWindow) continue;
      if (normalized.lat === null || normalized.lng === null) continue;

      const sourceRow = batch[normalized.index];
      const coordsAreReal =
        sourceRow &&
        coordinateMatchesRow(normalized.lat, sourceRow) &&
        coordinateMatchesRow(normalized.lng, sourceRow) &&
        isWithinUkBounds(normalized.lat, normalized.lng);

      if (!coordsAreReal) {
        console.warn(`${councilName}: discarding AI-reported coordinate that doesn't match source row (possible hallucination).`);
        continue;
      }

      spots.push({
        id: `${slugify(councilName)}-dynamic-${sha256(JSON.stringify(sourceRow)).slice(0, 12)}`,
        name: normalized.name,
        lat: normalized.lat,
        lng: normalized.lng,
        type: 'unknown',
        address: normalized.address,
        council: councilName,
        freeConditions: {
          alwaysFree: false,
          freeAfter: normalized.freeAfter,
          freeBefore: normalized.freeBefore,
          freeDays: normalized.freeDays,
          maxStayMinutes: normalized.maxStayMinutes,
          notes: normalized.notes,
        },
        capacity: null,
        source: 'ai-normalized',
        sourceDetail: raw.sourceUrl,
        confidence: 'ai-inferred',
        lastVerified: raw.fetchedAt,
      });
    }
  }

  return spots;
}

/**
 * Creates a CouncilAdapter for an arbitrary council name, discovered at
 * request time via data.gov.uk's CKAN API rather than hand-coded per council.
 * This is the fallback adapter used for any council without a curated,
 * hand-verified integration (e.g. Camden) — it scales to any council that
 * publishes a parking dataset, without per-council code, at the cost of
 * lower precision (mitigated by coordinate cross-validation) and coverage
 * limited to councils whose data happens to be in CSV/JSON/GeoJSON format.
 */
export function createDynamicCouncilAdapter(councilName: string): CouncilAdapter {
  return {
    councilId: slugify(councilName),
    displayName: `${councilName} (via data.gov.uk)`,
    refreshIntervalMs: 24 * 60 * 60 * 1000,
    fetchRaw: () => fetchRaw(councilName),
    normalize: (raw) => normalize(raw, councilName),
  };
}
