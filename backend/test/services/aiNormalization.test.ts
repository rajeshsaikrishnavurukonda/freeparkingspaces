import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateNormalizedBatch } from '../../src/services/aiNormalization/parkingSpotValidator';

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: createMock };
  },
}));

vi.mock('../../src/config/env', () => ({
  env: { anthropicApiKey: 'test-key' },
  aiNormalizationEnabled: true,
}));

import { normalizeRestrictionRows } from '../../src/services/aiNormalization/normalizeParkingData';
import { RawRestrictionRow } from '../../src/services/aiNormalization/prompts';

function textResponse(json: unknown) {
  return { content: [{ type: 'text', text: JSON.stringify(json) }] };
}

const sampleRows: RawRestrictionRow[] = [
  { index: 0, restrictionType: 'paid-for', timesOfOperation: 'mon-sat 08:30-18:30', maximumStay: '2 hours' },
];

beforeEach(() => {
  createMock.mockReset();
});

describe('validateNormalizedBatch', () => {
  it('accepts a well-formed batch', () => {
    const result = validateNormalizedBatch([
      { index: 0, hasFreeWindow: true, freeAfter: '18:30', freeBefore: '08:30', freeDays: ['Sun'], notes: null },
    ]);
    expect(result.success).toBe(true);
  });

  it('rejects a malformed time value', () => {
    const result = validateNormalizedBatch([
      { index: 0, hasFreeWindow: true, freeAfter: '6:30pm', freeBefore: null, freeDays: null, notes: null },
    ]);
    expect(result.success).toBe(false);
  });

  it('rejects a non-array payload', () => {
    expect(validateNormalizedBatch({ not: 'an array' }).success).toBe(false);
  });
});

describe('normalizeRestrictionRows', () => {
  it('returns validated rows on a successful first attempt', async () => {
    createMock.mockResolvedValueOnce(
      textResponse([{ index: 0, hasFreeWindow: true, freeAfter: '18:30', freeBefore: '08:30', freeDays: ['Sun'], notes: null }]),
    );

    const result = await normalizeRestrictionRows(sampleRows, 'Camden Council', 'test-hash-success');

    expect(result).toEqual([{ index: 0, hasFreeWindow: true, freeAfter: '18:30', freeBefore: '08:30', freeDays: ['Sun'], notes: null }]);
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it('retries once with a repair prompt after a validation failure, then succeeds', async () => {
    createMock
      .mockResolvedValueOnce(textResponse({ not: 'an array' }))
      .mockResolvedValueOnce(
        textResponse([{ index: 0, hasFreeWindow: false, freeAfter: null, freeBefore: null, freeDays: null, notes: null }]),
      );

    const result = await normalizeRestrictionRows(sampleRows, 'Camden Council', 'test-hash-repair');

    expect(result).toHaveLength(1);
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it('gives up and returns [] if both attempts fail validation', async () => {
    createMock.mockResolvedValue(textResponse({ bad: true }));

    const result = await normalizeRestrictionRows(sampleRows, 'Camden Council', 'test-hash-giveup');

    expect(result).toEqual([]);
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it('caches by content hash and does not call Claude again for the same hash', async () => {
    createMock.mockResolvedValueOnce(
      textResponse([{ index: 0, hasFreeWindow: true, freeAfter: '18:30', freeBefore: '08:30', freeDays: null, notes: null }]),
    );

    const first = await normalizeRestrictionRows(sampleRows, 'Camden Council', 'test-hash-cache');
    const second = await normalizeRestrictionRows(sampleRows, 'Camden Council', 'test-hash-cache');

    expect(second).toEqual(first);
    expect(createMock).toHaveBeenCalledTimes(1);
  });
});
