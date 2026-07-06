// From most to least precise: a full postcode ("AB12 8ST") pins down a single
// building/street; a subsector ("AB12 8S") and sector ("AB12 8") are
// progressively wider real UK postal subdivisions; an outcode ("AB12") is a
// whole postal district; "place" is a Nominatim place-name match.
export type GeocodePrecision = 'postcode' | 'subsector' | 'sector' | 'outcode' | 'place';

export interface GeocodedLocation {
  lat: number;
  lng: number;
  label: string;
  postcode?: string | null;
  adminDistrict?: string | null;
  source: 'postcodes.io' | 'nominatim';
  /**
   * How precisely `lat`/`lng` pin down the search area. Anything coarser than
   * a full postcode resolves to one centroid point covering a much larger
   * real-world area, so callers should widen the search radius accordingly
   * rather than treating every result the same.
   */
  precision: GeocodePrecision;
}
