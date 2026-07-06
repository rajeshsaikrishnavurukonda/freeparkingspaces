import { describe, it, expect, vi } from 'vitest';

const { normalizeMock } = vi.hoisted(() => ({ normalizeMock: vi.fn() }));

vi.mock('../../src/services/aiNormalization/normalizeParkingData', () => ({
  normalizeRestrictionRows: normalizeMock,
}));

import { camdenAdapter } from '../../src/services/councilAdapters/camdenParkingBaysAdapter';
import { RawCouncilPayload } from '../../src/services/councilAdapters/types';

function makeRawPayload(rows: unknown[]): RawCouncilPayload {
  return {
    contentType: 'json',
    body: JSON.stringify(rows),
    fetchedAt: '2026-07-05T12:00:00.000Z',
    contentHash: 'irrelevant-for-this-test',
    sourceUrl: 'https://opendata.camden.gov.uk/resource/7hiv-3r9k.json',
  };
}

describe('camdenAdapter.normalize', () => {
  it('maps a free-window row into a ParkingSpot and skips rows without a free window', async () => {
    const rows = [
      {
        unique_identifier: '1',
        restriction_type: 'paid-for',
        times_of_operation: 'mon-sat 08:30-18:30',
        maximum_stay: '2 hours',
        road_name: 'Fitzroy Street',
        postcode: 'W1T 5BR',
        parking_spaces: '3',
        latitude: '51.5237',
        longitude: '-0.1401',
      },
      {
        unique_identifier: '2',
        restriction_type: 'paid-for',
        times_of_operation: 'at any time',
        maximum_stay: 'N/A',
        road_name: 'No Free Street',
        postcode: 'W1T 5BX',
        parking_spaces: '1',
        latitude: '51.52',
        longitude: '-0.14',
      },
    ];

    normalizeMock.mockResolvedValueOnce([
      { index: 0, hasFreeWindow: true, freeAfter: '18:30', freeBefore: '08:30', freeDays: ['Sun'], notes: null },
      { index: 1, hasFreeWindow: false, freeAfter: null, freeBefore: null, freeDays: null, notes: null },
    ]);

    const spots = await camdenAdapter.normalize(makeRawPayload(rows));

    expect(spots).toHaveLength(1);
    expect(spots[0]).toMatchObject({
      id: 'camden-1',
      lat: 51.5237,
      lng: -0.1401,
      type: 'on_street_bay',
      council: 'Camden Council',
      source: 'ai-normalized',
      confidence: 'ai-inferred',
      capacity: 3,
    });
    expect(spots[0].freeConditions).toMatchObject({
      alwaysFree: false,
      freeAfter: '18:30',
      freeBefore: '08:30',
      freeDays: ['Sun'],
      maxStayMinutes: 120,
    });
  });

  it('skips rows with invalid coordinates even if flagged as having a free window', async () => {
    const rows = [
      {
        unique_identifier: '3',
        restriction_type: 'paid-for',
        times_of_operation: 'mon-fri 09:00-17:00',
        maximum_stay: 'N/A',
        latitude: 'not-a-number',
        longitude: '-0.14',
      },
    ];

    normalizeMock.mockResolvedValueOnce([
      { index: 0, hasFreeWindow: true, freeAfter: '17:00', freeBefore: '09:00', freeDays: null, notes: null },
    ]);

    const spots = await camdenAdapter.normalize(makeRawPayload(rows));
    expect(spots).toHaveLength(0);
  });
});
