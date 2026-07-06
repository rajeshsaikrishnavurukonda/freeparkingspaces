import crypto from 'crypto';
import { CouncilAdapter, RawCouncilPayload } from './types';
import { ParkingSpot } from '../../shared/types/parkingSpot';
import { parseMaxStayMinutes } from '../osm/osmParkingAdapter';
import { normalizeRestrictionRows } from '../aiNormalization/normalizeParkingData';
import { RawRestrictionRow } from '../aiNormalization/prompts';

const USER_AGENT = 'uk-free-parking-finder/0.1 (contact: rajesh.saikrishna@gmail.com)';
const DATASET_URL = 'https://opendata.camden.gov.uk/resource/7hiv-3r9k.json';
const FIELDS = 'unique_identifier,restriction_type,times_of_operation,maximum_stay,road_name,postcode,parking_spaces,latitude,longitude';
const BATCH_SIZE = 25;

interface CamdenRawRow {
  unique_identifier: string;
  restriction_type: string;
  times_of_operation: string;
  maximum_stay: string;
  road_name?: string;
  postcode?: string;
  parking_spaces?: string;
  latitude: string;
  longitude: string;
}

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

async function fetchRaw(): Promise<RawCouncilPayload> {
  const url = `${DATASET_URL}?$select=${FIELDS}&$where=${encodeURIComponent("restriction_type like '%paid%'")}&$limit=2000`;

  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Camden open data fetch failed with status ${res.status}`);
  }
  const body = await res.text();

  return {
    contentType: 'json',
    body,
    fetchedAt: new Date().toISOString(),
    contentHash: sha256(body),
    sourceUrl: url,
  };
}

async function normalize(raw: RawCouncilPayload): Promise<ParkingSpot[]> {
  const rows: CamdenRawRow[] = JSON.parse(raw.body);
  const spots: ParkingSpot[] = [];

  for (const batch of chunk(rows, BATCH_SIZE)) {
    const restrictionRows: RawRestrictionRow[] = batch.map((row, index) => ({
      index,
      restrictionType: row.restriction_type,
      timesOfOperation: row.times_of_operation,
      maximumStay: row.maximum_stay,
    }));

    const batchHash = sha256(JSON.stringify(restrictionRows));
    const normalizedRows = await normalizeRestrictionRows(restrictionRows, 'Camden Council', batchHash);

    for (const normalized of normalizedRows) {
      if (!normalized.hasFreeWindow) continue;

      const row = batch[normalized.index];
      const lat = parseFloat(row.latitude);
      const lng = parseFloat(row.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      spots.push({
        id: `camden-${row.unique_identifier}`,
        name: null,
        lat,
        lng,
        type: 'on_street_bay',
        address: [row.road_name, row.postcode].filter(Boolean).join(', ') || null,
        council: 'Camden Council',
        freeConditions: {
          alwaysFree: false,
          freeAfter: normalized.freeAfter,
          freeBefore: normalized.freeBefore,
          freeDays: normalized.freeDays,
          maxStayMinutes: parseMaxStayMinutes(row.maximum_stay),
          notes: normalized.notes ?? `Restricted "${row.restriction_type}" ${row.times_of_operation}; free outside that window`,
        },
        capacity: row.parking_spaces ? parseInt(row.parking_spaces, 10) || null : null,
        source: 'ai-normalized',
        sourceDetail: `${raw.sourceUrl}#${row.unique_identifier}`,
        confidence: 'ai-inferred',
        lastVerified: raw.fetchedAt,
      });
    }
  }

  return spots;
}

export const camdenAdapter: CouncilAdapter = {
  councilId: 'camden',
  displayName: 'Camden Council',
  refreshIntervalMs: 24 * 60 * 60 * 1000,
  fetchRaw,
  normalize,
};
