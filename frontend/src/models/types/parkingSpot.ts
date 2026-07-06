export type ParkingSpotType = 'on_street_bay' | 'car_park' | 'free_after_hours_zone' | 'unknown';
export type ParkingSpotSource = 'osm' | 'council-open-data' | 'ai-normalized';
export type ParkingSpotConfidence = 'baseline' | 'verified' | 'ai-inferred';
export type WeekdayOrHoliday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun' | 'PublicHoliday';

export interface FreeConditions {
  alwaysFree: boolean;
  freeAfter?: string | null;
  freeBefore?: string | null;
  freeDays?: WeekdayOrHoliday[] | null;
  maxStayMinutes?: number | null;
  notes?: string | null;
}

export interface ParkingSpot {
  id: string;
  name?: string | null;
  lat: number;
  lng: number;
  type: ParkingSpotType;
  address?: string | null;
  council?: string | null;
  freeConditions: FreeConditions;
  capacity?: number | null;
  source: ParkingSpotSource;
  sourceDetail?: string | null;
  confidence: ParkingSpotConfidence;
  lastVerified: string;
}

export type GeocodePrecision = 'postcode' | 'subsector' | 'sector' | 'outcode' | 'place';

export interface GeocodedLocation {
  lat: number;
  lng: number;
  label: string;
  postcode?: string | null;
  adminDistrict?: string | null;
  source: 'postcodes.io' | 'nominatim';
  precision: GeocodePrecision;
}

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
