export interface Coordinates {
  lat: number;
  lng: number;
}

export function haversineMeters(a: Coordinates, b: Coordinates): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const METERS_PER_MILE = 1609.344;

export function formatDistance(meters: number): string {
  if (meters < METERS_PER_MILE) return `${Math.round(meters)} m`;
  return `${(meters / METERS_PER_MILE).toFixed(1)} mi`;
}
