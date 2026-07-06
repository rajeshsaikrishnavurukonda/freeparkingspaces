import { ParkingSpot } from '../../shared/types/parkingSpot';
import { haversineMeters } from '../../utils/geo';

const SOURCE_PRIORITY: Record<ParkingSpot['source'], number> = {
  'council-open-data': 3,
  'ai-normalized': 2,
  osm: 1,
};

const DEDUPE_RADIUS_METERS = 15;

/**
 * Merges spots from multiple sources, deduplicating spots that represent the
 * same physical location. Where sources overlap, the higher-priority source
 * (council open data > AI-normalized > OSM baseline) wins.
 */
export function mergeSpots(...sourceLists: ParkingSpot[][]): ParkingSpot[] {
  const all = sourceLists.flat();
  const kept: ParkingSpot[] = [];

  for (const spot of all) {
    const overlapIndex = kept.findIndex((k) => haversineMeters(k.lat, k.lng, spot.lat, spot.lng) <= DEDUPE_RADIUS_METERS);
    if (overlapIndex === -1) {
      kept.push(spot);
      continue;
    }
    const existing = kept[overlapIndex];
    if (SOURCE_PRIORITY[spot.source] > SOURCE_PRIORITY[existing.source]) {
      kept[overlapIndex] = spot;
    }
  }

  return kept;
}
