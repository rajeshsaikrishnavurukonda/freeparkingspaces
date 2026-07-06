const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
];
const USER_AGENT = 'parkzen/0.1 (contact: support@parkzen.co.uk)';

export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

function buildQuery(lat: number, lng: number, radiusMeters: number): string {
  // `nwr` (node/way/relation combined) and cheap equality/existence filters
  // keep this affordable at larger radii in dense cities. A car park with
  // fee="yes" but a fee:conditional tag (e.g. "no @ (18:00-08:00)", free
  // overnight/on Sundays) must still be fetched here — filtering it out by
  // fee value alone would make that tag unreachable by the parsing step
  // downstream, which is exactly the "limited hours" case this app targets.
  //
  // On-street: an explicit parking:condition=free tag is rare in OSM (most UK
  // mapping only bothers tagging *restrictions*, e.g. permit/no_parking, not
  // the absence of one). The single regex-key clause below fetches any way
  // with either a parking:lane:* (marked bay, physical layout) or
  // parking:condition:* (restriction) tag on any side — classification of
  // "explicitly free" vs "restricted" vs "marked but no known restriction"
  // happens downstream, since that can't be expressed as a single query filter.
  return `
[out:json][timeout:25];
(
  nwr["amenity"="parking"]["fee"="no"](around:${radiusMeters},${lat},${lng});
  nwr["amenity"="parking"]["fee:conditional"](around:${radiusMeters},${lat},${lng});
  way["highway"][~"^parking:(lane|condition):(both|left|right)$"~"."](around:${radiusMeters},${lat},${lng});
);
out center tags;
`.trim();
}

export async function queryOverpass(lat: number, lng: number, radiusMeters: number): Promise<OverpassElement[]> {
  const query = buildQuery(lat, lng, radiusMeters);
  let lastError: unknown;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    // Must exceed the query's own [timeout:25] so we get the server's real
    // response/error instead of aborting client-side first and masking it.
    const timeout = setTimeout(() => controller.abort(), 27000);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          Accept: 'application/json',
          'User-Agent': USER_AGENT,
        },
        body: query,
        signal: controller.signal,
      });
      if (!res.ok) {
        lastError = new Error(`Overpass endpoint ${endpoint} returned ${res.status}`);
        console.error(String(lastError));
        continue;
      }
      const json = (await res.json()) as OverpassResponse;
      return json.elements || [];
    } catch (err) {
      lastError = err;
      console.error(`Overpass endpoint ${endpoint} threw:`, err);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('All Overpass endpoints failed');
}
