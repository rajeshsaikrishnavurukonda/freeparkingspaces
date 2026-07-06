import { describe, it, expect, vi, afterEach } from 'vitest';
import { classifyPostcodeInput, geocodeWithPostcodesIo } from '../../src/services/geocoding/postcodesIoClient';

describe('classifyPostcodeInput', () => {
  it('classifies a full postcode', () => {
    expect(classifyPostcodeInput('SW1A 1AA')).toBe('postcode');
    expect(classifyPostcodeInput('SW1A1AA')).toBe('postcode');
  });

  it('classifies a subsector (sector + unit letter)', () => {
    expect(classifyPostcodeInput('SW1A 1A')).toBe('subsector');
    expect(classifyPostcodeInput('SW1A1A')).toBe('subsector');
  });

  it('classifies a sector (outcode + digit)', () => {
    expect(classifyPostcodeInput('SW1A 1')).toBe('sector');
    expect(classifyPostcodeInput('SW1A1')).toBe('sector');
  });

  it('classifies an outcode', () => {
    expect(classifyPostcodeInput('BH17')).toBe('outcode');
    expect(classifyPostcodeInput('SW1A')).toBe('outcode');
  });

  it('classifies a non-postcode string as none', () => {
    expect(classifyPostcodeInput('Manchester Piccadilly')).toBe('none');
    expect(classifyPostcodeInput('')).toBe('none');
  });
});

describe('geocodeWithPostcodesIo (sector/subsector)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves a sector to the centroid of its matching postcodes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: ['SW1A 1AA', 'SW1A 1AB'] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: [
            { query: 'SW1A 1AA', result: { latitude: 51.5, longitude: -0.14, admin_district: 'Westminster' } },
            { query: 'SW1A 1AB', result: { latitude: 51.51, longitude: -0.15, admin_district: 'Westminster' } },
          ],
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await geocodeWithPostcodesIo('SW1A 1');

    expect(result).toMatchObject({
      lat: (51.5 + 51.51) / 2,
      lng: (-0.14 + -0.15) / 2,
      adminDistrict: 'Westminster',
      precision: 'sector',
    });
  });

  it('returns null when autocomplete finds no matches for a sector', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ result: null }) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await geocodeWithPostcodesIo('ZZ9 9');
    expect(result).toBeNull();
  });
});
