import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { normalizeGenericMock } = vi.hoisted(() => ({ normalizeGenericMock: vi.fn() }));

vi.mock('../../src/services/aiNormalization/normalizeParkingData', () => ({
  normalizeGenericRows: normalizeGenericMock,
}));

import { createDynamicCouncilAdapter } from '../../src/services/councilAdapters/dataGovUkCouncilAdapter';

function ckanSearchResponse(datasets: unknown[]) {
  return { result: { results: datasets } };
}

beforeEach(() => {
  normalizeGenericMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createDynamicCouncilAdapter.fetchRaw', () => {
  it('finds a matching dataset for the council and downloads its resource', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () =>
          ckanSearchResponse([
            {
              title: 'Leeds parking bays',
              organization: { title: 'Leeds City Council' },
              resources: [{ format: 'CSV', url: 'https://example.com/leeds-bays.csv' }],
            },
          ]),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => 'road,latitude,longitude\nHigh Street,53.8,-1.55',
      });
    vi.stubGlobal('fetch', fetchMock);

    const adapter = createDynamicCouncilAdapter('Leeds');
    const raw = await adapter.fetchRaw();

    expect(raw.contentType).toBe('csv');
    expect(raw.datasetTitle).toBe('Leeds parking bays');
    expect(raw.sourceUrl).toBe('https://example.com/leeds-bays.csv');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('ignores datasets from a different council even if they mention parking', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () =>
        ckanSearchResponse([
          {
            title: 'Rother parking',
            organization: { title: 'Rother District Council' },
            resources: [{ format: 'CSV', url: 'https://example.com/rother.csv' }],
          },
        ]),
    });
    vi.stubGlobal('fetch', fetchMock);

    const adapter = createDynamicCouncilAdapter('Leeds');
    const raw = await adapter.fetchRaw();

    expect(raw.body).toBe('__no_dataset_found__');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns a sentinel empty payload when no dataset is found at all', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ckanSearchResponse([]) });
    vi.stubGlobal('fetch', fetchMock);

    const adapter = createDynamicCouncilAdapter('Nowhereshire');
    const raw = await adapter.fetchRaw();

    const spots = await adapter.normalize(raw);
    expect(spots).toEqual([]);
  });
});

describe('createDynamicCouncilAdapter.normalize', () => {
  it('creates a spot when the AI-reported coordinate matches a real value in the row', async () => {
    const adapter = createDynamicCouncilAdapter('Leeds');
    const raw = {
      contentType: 'csv' as const,
      body: 'road,lat,lng\nHigh Street,53.8,-1.55',
      fetchedAt: '2026-07-06T00:00:00.000Z',
      contentHash: 'irrelevant',
      sourceUrl: 'https://example.com/leeds.csv',
      datasetTitle: 'Leeds parking bays',
    };

    normalizeGenericMock.mockResolvedValueOnce([
      {
        index: 0,
        isParkingLocation: true,
        lat: 53.8,
        lng: -1.55,
        name: 'High Street bay',
        address: 'High Street',
        hasFreeWindow: true,
        freeAfter: '18:00',
        freeBefore: '08:00',
        freeDays: null,
        maxStayMinutes: null,
        notes: null,
      },
    ]);

    const spots = await adapter.normalize(raw);

    expect(spots).toHaveLength(1);
    expect(spots[0]).toMatchObject({
      lat: 53.8,
      lng: -1.55,
      council: 'Leeds',
      source: 'ai-normalized',
      confidence: 'ai-inferred',
    });
  });

  it('discards a spot when the AI-reported coordinate does not match any value in the row (hallucination guard)', async () => {
    const adapter = createDynamicCouncilAdapter('Leeds');
    const raw = {
      contentType: 'csv' as const,
      body: 'road,lat,lng\nHigh Street,53.8,-1.55',
      fetchedAt: '2026-07-06T00:00:00.000Z',
      contentHash: 'irrelevant',
      sourceUrl: 'https://example.com/leeds.csv',
      datasetTitle: 'Leeds parking bays',
    };

    normalizeGenericMock.mockResolvedValueOnce([
      {
        index: 0,
        isParkingLocation: true,
        lat: 51.5, // hallucinated — not present anywhere in the source row
        lng: -0.14,
        name: 'High Street bay',
        address: 'High Street',
        hasFreeWindow: true,
        freeAfter: '18:00',
        freeBefore: '08:00',
        freeDays: null,
        maxStayMinutes: null,
        notes: null,
      },
    ]);

    const spots = await adapter.normalize(raw);
    expect(spots).toEqual([]);
  });

  it('skips rows that are not parking locations or have no free window', async () => {
    const adapter = createDynamicCouncilAdapter('Leeds');
    const raw = {
      contentType: 'json' as const,
      body: JSON.stringify([{ lat: 53.8, lng: -1.55 }]),
      fetchedAt: '2026-07-06T00:00:00.000Z',
      contentHash: 'irrelevant',
      sourceUrl: 'https://example.com/leeds.json',
      datasetTitle: 'Leeds parking bays',
    };

    normalizeGenericMock.mockResolvedValueOnce([
      {
        index: 0,
        isParkingLocation: false,
        lat: null,
        lng: null,
        name: null,
        address: null,
        hasFreeWindow: false,
        freeAfter: null,
        freeBefore: null,
        freeDays: null,
        maxStayMinutes: null,
        notes: null,
      },
    ]);

    const spots = await adapter.normalize(raw);
    expect(spots).toEqual([]);
  });

  it('batches rows in groups and calls normalizeGenericRows once per batch', async () => {
    const adapter = createDynamicCouncilAdapter('Leeds');
    const rows = Array.from({ length: 25 }, (_, i) => ({ id: i, lat: 53.8, lng: -1.55 }));
    const raw = {
      contentType: 'json' as const,
      body: JSON.stringify(rows),
      fetchedAt: '2026-07-06T00:00:00.000Z',
      contentHash: 'irrelevant',
      sourceUrl: 'https://example.com/leeds.json',
      datasetTitle: 'Leeds parking bays',
    };

    normalizeGenericMock.mockResolvedValue([]);

    await adapter.normalize(raw);

    expect(normalizeGenericMock).toHaveBeenCalledTimes(2); // 25 rows / batch size 20 -> 2 batches
  });
});
