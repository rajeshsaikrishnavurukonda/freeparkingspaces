export interface DirectionsLink {
  label: string;
  url: string;
}

export function buildGoogleMapsDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function buildAppleMapsDirectionsUrl(lat: number, lng: number): string {
  return `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
}

/**
 * Returns the directions links to show for a spot: Apple Maps + Google Maps
 * on Apple platforms (since Apple Maps is usually the more native choice
 * there), Google Maps only elsewhere.
 */
export function getDirectionsLinks(lat: number, lng: number, isApple: boolean): DirectionsLink[] {
  const google: DirectionsLink = { label: 'Google Maps', url: buildGoogleMapsDirectionsUrl(lat, lng) };
  if (!isApple) return [google];

  const apple: DirectionsLink = { label: 'Apple Maps', url: buildAppleMapsDirectionsUrl(lat, lng) };
  return [apple, google];
}
