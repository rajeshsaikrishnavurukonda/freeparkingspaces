const UK_LAT_RANGE: [number, number] = [49.5, 61];
const UK_LNG_RANGE: [number, number] = [-8.5, 2];

export function isWithinUkBounds(lat: number, lng: number): boolean {
  return lat >= UK_LAT_RANGE[0] && lat <= UK_LAT_RANGE[1] && lng >= UK_LNG_RANGE[0] && lng <= UK_LNG_RANGE[1];
}

/**
 * Confirms a claimed coordinate actually appears as a real numeric value
 * somewhere in the raw source row (within floating point tolerance). Used to
 * verify AI-reported lat/lng for dynamically-discovered datasets whose column
 * names aren't known in advance — the AI can suggest which value is the
 * coordinate, but code alone decides whether to trust it, so a hallucinated
 * coordinate can never survive even if the AI is confidently wrong.
 */
export function coordinateMatchesRow(value: number, row: Record<string, unknown>, tolerance = 0.0005): boolean {
  return Object.values(row).some((v) => {
    const num = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
    return Number.isFinite(num) && Math.abs(num - value) <= tolerance;
  });
}
