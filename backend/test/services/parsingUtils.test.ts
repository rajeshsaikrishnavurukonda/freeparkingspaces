import { describe, it, expect } from 'vitest';
import { isWithinUkBounds, coordinateMatchesRow } from '../../src/utils/coordinateValidation';
import { parseTabularRows } from '../../src/utils/parseTabularRows';

describe('isWithinUkBounds', () => {
  it('accepts a real UK coordinate', () => {
    expect(isWithinUkBounds(51.5237, -0.1401)).toBe(true);
  });

  it('rejects a coordinate outside the UK bounding box', () => {
    expect(isWithinUkBounds(40.7128, -74.006)).toBe(false);
  });
});

describe('coordinateMatchesRow', () => {
  const row = { latitude: '51.5237', longitude: '-0.1401', restriction_type: 'paid-for' };

  it('accepts a value that matches a real field in the row', () => {
    expect(coordinateMatchesRow(51.5237, row)).toBe(true);
  });

  it('rejects a hallucinated value not present in the row', () => {
    expect(coordinateMatchesRow(52.9999, row)).toBe(false);
  });

  it('tolerates tiny floating point differences', () => {
    expect(coordinateMatchesRow(51.52371, row)).toBe(true);
  });
});

describe('parseTabularRows', () => {
  it('parses CSV with headers', () => {
    const csv = 'road_name,latitude,longitude\nFitzroy Street,51.5237,-0.1401';
    const rows = parseTabularRows(csv, 'csv');
    expect(rows).toEqual([{ road_name: 'Fitzroy Street', latitude: '51.5237', longitude: '-0.1401' }]);
  });

  it('parses a plain JSON array', () => {
    const rows = parseTabularRows(JSON.stringify([{ a: 1 }, { a: 2 }]), 'json');
    expect(rows).toHaveLength(2);
  });

  it('unwraps a CKAN datastore-style records wrapper', () => {
    const rows = parseTabularRows(JSON.stringify({ result: { records: [{ a: 1 }] } }), 'json');
    expect(rows).toEqual([{ a: 1 }]);
  });

  it('parses GeoJSON features into flat rows with geometry attached', () => {
    const geojson = JSON.stringify({
      features: [{ properties: { name: 'Bay 1' }, geometry: { type: 'Point', coordinates: [-0.14, 51.52] } }],
    });
    const rows = parseTabularRows(geojson, 'geojson');
    expect(rows).toEqual([{ name: 'Bay 1', __geometry: { type: 'Point', coordinates: [-0.14, 51.52] } }]);
  });
});
