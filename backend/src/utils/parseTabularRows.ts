import { parse } from 'csv-parse/sync';

interface GeoJsonFeature {
  properties?: Record<string, unknown>;
  geometry?: { type: string; coordinates: unknown };
}

/**
 * Parses an unknown council resource (CSV, GeoJSON, or plain/CKAN-wrapped JSON)
 * into a flat array of row objects with unknown column names. There is no
 * fixed schema across councils, so this only normalizes structure/format —
 * interpreting the columns themselves is left to the AI extraction step.
 */
export function parseTabularRows(body: string, contentType: 'csv' | 'json' | 'geojson'): Record<string, unknown>[] {
  if (contentType === 'csv') {
    return parse(body, { columns: true, skip_empty_lines: true, relax_column_count: true }) as Record<string, unknown>[];
  }

  const json = JSON.parse(body);

  if (contentType === 'geojson') {
    const features: GeoJsonFeature[] = json.features ?? [];
    return features.map((f) => ({ ...(f.properties ?? {}), __geometry: f.geometry }));
  }

  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.result?.records)) return json.result.records;
  if (Array.isArray(json?.records)) return json.records;
  return [];
}
