import 'dotenv/config';

function optionalInt(value: string | undefined, fallback: number): number {
  const parsed = value ? parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  port: optionalInt(process.env.PORT, 4000),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || undefined,
  geocodeCacheTtlSeconds: optionalInt(process.env.GEOCODE_CACHE_TTL, 7 * 24 * 60 * 60),
  osmCacheTtlSeconds: optionalInt(process.env.OSM_CACHE_TTL, 12 * 60 * 60),
  searchResultCacheTtlSeconds: optionalInt(process.env.SEARCH_RESULT_CACHE_TTL, 15 * 60),
};

export const aiNormalizationEnabled = Boolean(env.anthropicApiKey);
