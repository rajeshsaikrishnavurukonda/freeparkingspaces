import { ParkingSpot } from '../../shared/types/parkingSpot';

export type RawContentType = 'csv' | 'geojson' | 'json' | 'html' | 'pdf-text';

export interface RawCouncilPayload {
  contentType: RawContentType;
  body: string;
  fetchedAt: string;
  contentHash: string;
  sourceUrl: string;
  /** Human-readable dataset title, used as AI prompt context when available. */
  datasetTitle?: string;
}

export interface CouncilAdapter {
  councilId: string;
  displayName: string;
  refreshIntervalMs: number;
  fetchRaw(): Promise<RawCouncilPayload>;
  normalize(raw: RawCouncilPayload): Promise<ParkingSpot[]>;
}
