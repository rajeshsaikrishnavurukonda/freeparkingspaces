import { ParkingSpot } from './parkingSpot';
import { GeocodedLocation } from './geocodedLocation';

export interface SearchMeta {
  sourcesUsed: string[];
  councilAdapterAvailable: boolean;
  cacheHit: boolean;
  generatedAt: string;
  notes?: string;
  warnings?: string[];
}

export interface SearchResponse {
  query: { location: string; radius: number };
  resolvedLocation: GeocodedLocation;
  spots: ParkingSpot[];
  meta: SearchMeta;
}

export interface ApiErrorBody {
  error: string;
  message: string;
}
