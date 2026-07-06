import { describe, it, expect } from 'vitest';
import { mergeSpots } from '../../src/services/merge/spotMerger';
import { ParkingSpot } from '../../src/shared/types/parkingSpot';

function makeSpot(overrides: Partial<ParkingSpot>): ParkingSpot {
  return {
    id: 'id-1',
    name: null,
    lat: 51.5,
    lng: -0.1,
    type: 'car_park',
    address: null,
    council: null,
    freeConditions: { alwaysFree: true },
    capacity: null,
    source: 'osm',
    sourceDetail: null,
    confidence: 'baseline',
    lastVerified: new Date().toISOString(),
    ...overrides,
  };
}

describe('mergeSpots', () => {
  it('keeps spots from different locations separate', () => {
    const a = makeSpot({ id: 'a', lat: 51.5, lng: -0.1 });
    const b = makeSpot({ id: 'b', lat: 52.0, lng: -1.0 });
    expect(mergeSpots([a, b])).toHaveLength(2);
  });

  it('deduplicates spots within the proximity radius, keeping the higher-priority source', () => {
    const osmSpot = makeSpot({ id: 'osm-1', source: 'osm', confidence: 'baseline', lat: 51.5, lng: -0.1 });
    const councilSpot = makeSpot({
      id: 'council-1',
      source: 'council-open-data',
      confidence: 'verified',
      lat: 51.50005,
      lng: -0.1,
    });

    const merged = mergeSpots([osmSpot], [councilSpot]);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('council-1');
    expect(merged[0].source).toBe('council-open-data');
  });

  it('does not let a lower-priority source overwrite an already-kept higher-priority spot', () => {
    const councilSpot = makeSpot({ id: 'council-1', source: 'council-open-data', lat: 51.5, lng: -0.1 });
    const osmSpot = makeSpot({ id: 'osm-1', source: 'osm', lat: 51.50005, lng: -0.1 });

    const merged = mergeSpots([councilSpot], [osmSpot]);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('council-1');
  });
});
