import { GeocodedLocation } from '../../shared/types/geocodedLocation';

const USER_AGENT = 'parkzen/0.1 (contact: support@parkzen.co.uk)';

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    city?: string;
    town?: string;
    county?: string;
    state_district?: string;
    municipality?: string;
  };
}

export async function geocodeWithNominatim(input: string): Promise<GeocodedLocation | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', input);
    url.searchParams.set('countrycodes', 'gb');
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '1');

    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return null;

    const results = (await res.json()) as NominatimResult[];
    const first = results[0];
    if (!first) return null;

    const adminDistrict =
      first.address?.city || first.address?.town || first.address?.municipality || first.address?.state_district || null;

    return {
      lat: parseFloat(first.lat),
      lng: parseFloat(first.lon),
      label: first.display_name,
      postcode: null,
      adminDistrict,
      source: 'nominatim',
      precision: 'place',
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
