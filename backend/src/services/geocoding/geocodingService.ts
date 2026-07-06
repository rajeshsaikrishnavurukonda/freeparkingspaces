import { GeocodedLocation } from '../../shared/types/geocodedLocation';
import { cache } from '../cache/inMemoryCacheProvider';
import { env } from '../../config/env';
import { looksLikePostcode, geocodeWithPostcodesIo } from './postcodesIoClient';
import { geocodeWithNominatim } from './nominatimClient';

function cacheKey(input: string): string {
  return `geocode:${input.trim().toLowerCase()}`;
}

export async function geocodeLocation(input: string): Promise<GeocodedLocation | null> {
  const key = cacheKey(input);
  const cached = cache.get<GeocodedLocation>(key);
  if (cached) return cached;

  let result: GeocodedLocation | null = null;

  if (looksLikePostcode(input)) {
    result = await geocodeWithPostcodesIo(input);
  }

  if (!result) {
    result = await geocodeWithNominatim(input);
  }

  if (result) {
    cache.set(key, result, env.geocodeCacheTtlSeconds);
  }

  return result;
}
