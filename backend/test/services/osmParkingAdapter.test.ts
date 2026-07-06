import { describe, it, expect } from 'vitest';
import { parseFeeConditional, parseMaxStayMinutes, buildFreeConditions, classifyType, elementToSpot } from '../../src/services/osm/osmParkingAdapter';

describe('parseMaxStayMinutes', () => {
  it('parses hours', () => {
    expect(parseMaxStayMinutes('2 h')).toBe(120);
    expect(parseMaxStayMinutes('1.5h')).toBe(90);
  });

  it('parses minutes', () => {
    expect(parseMaxStayMinutes('30 min')).toBe(30);
  });

  it('returns null for missing/unparseable input', () => {
    expect(parseMaxStayMinutes(undefined)).toBeNull();
    expect(parseMaxStayMinutes('unlimited')).toBeNull();
  });
});

describe('parseFeeConditional', () => {
  it('parses an overnight free time window', () => {
    expect(parseFeeConditional('no @ (18:00-08:00)')).toEqual({
      freeAfter: '18:00',
      freeBefore: '08:00',
      freeDays: null,
    });
  });

  it('parses free days including public holidays', () => {
    expect(parseFeeConditional('no @ (Su,PH)')).toEqual({
      freeAfter: null,
      freeBefore: null,
      freeDays: ['Sun', 'PublicHoliday'],
    });
  });

  it('expands a day range', () => {
    expect(parseFeeConditional('no @ (Sa-Su)')).toEqual({
      freeAfter: null,
      freeBefore: null,
      freeDays: ['Sat', 'Sun'],
    });
  });

  it('does not guess for a same-day time window (ambiguous "free between" semantics)', () => {
    expect(parseFeeConditional('no @ (09:00-17:00)')).toBeNull();
  });

  it('ignores clauses whose value is not "no"', () => {
    expect(parseFeeConditional('yes @ (Mo-Fr 08:00-18:00)')).toBeNull();
  });
});

describe('buildFreeConditions', () => {
  it('marks fee=no as always free', () => {
    expect(buildFreeConditions({ fee: 'no' }).alwaysFree).toBe(true);
  });

  it('marks on-street parking:condition free tags as always free', () => {
    expect(buildFreeConditions({ 'parking:condition:both': 'free' }).alwaysFree).toBe(true);
  });

  it('surfaces conditional free windows even when the base fee is "yes"', () => {
    const fc = buildFreeConditions({ fee: 'yes', 'fee:conditional': 'no @ (Su,PH)' });
    expect(fc.alwaysFree).toBe(false);
    expect(fc.freeDays).toEqual(['Sun', 'PublicHoliday']);
    expect(fc.notes).toContain('no @ (Su,PH)');
  });

  it('treats a marked on-street lane with no restriction tag as presumed free, with a caveat note', () => {
    const fc = buildFreeConditions({ highway: 'residential', 'parking:lane:both': 'parallel' });
    expect(fc.alwaysFree).toBe(true);
    expect(fc.notes).toMatch(/not confirmed/i);
  });

  it('does not mark a restricted on-street bay as free even if it has a marked lane', () => {
    const fc = buildFreeConditions({ highway: 'residential', 'parking:lane:both': 'parallel', 'parking:condition:both': 'residents' });
    expect(fc.alwaysFree).toBe(false);
    expect(fc.notes).toBeNull();
  });

  it('does not treat parking:lane="no" as a marked bay', () => {
    const fc = buildFreeConditions({ highway: 'residential', 'parking:lane:both': 'no' });
    expect(fc.alwaysFree).toBe(false);
  });
});

describe('classifyType', () => {
  it('classifies amenity=parking as car_park', () => {
    expect(classifyType({ amenity: 'parking' })).toBe('car_park');
  });

  it('classifies tagged highway ways as on_street_bay', () => {
    expect(classifyType({ highway: 'residential', 'parking:condition:both': 'free' })).toBe('on_street_bay');
  });

  it('classifies a marked lane with no restriction tag as on_street_bay too', () => {
    expect(classifyType({ highway: 'residential', 'parking:lane:both': 'parallel' })).toBe('on_street_bay');
  });

  it('falls back to unknown', () => {
    expect(classifyType({})).toBe('unknown');
  });
});

describe('elementToSpot', () => {
  it('returns null when coordinates are missing', () => {
    expect(elementToSpot({ type: 'way', id: 1, tags: { amenity: 'parking', fee: 'no' } })).toBeNull();
  });

  it('maps a free car park node to a ParkingSpot', () => {
    const spot = elementToSpot({
      type: 'node',
      id: 42,
      lat: 51.5,
      lon: -0.1,
      tags: { amenity: 'parking', fee: 'no', name: 'Test Car Park' },
    });
    expect(spot).toMatchObject({
      id: 'osm-node-42',
      name: 'Test Car Park',
      lat: 51.5,
      lng: -0.1,
      type: 'car_park',
      source: 'osm',
      confidence: 'baseline',
    });
    expect(spot?.freeConditions.alwaysFree).toBe(true);
  });
});
