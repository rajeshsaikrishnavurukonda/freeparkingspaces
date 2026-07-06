import { API_BASE_URL } from '../../config/env';
import type { ApiErrorBody, SearchResponse } from '../types/parkingSpot';

export class ApiError extends Error {
  status: number;
  body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.status = status;
    this.body = body;
  }
}

/**
 * `radius` is intentionally optional and omitted by default — the backend
 * picks an appropriate default based on how precise the geocoded location is
 * (e.g. a wider radius for an outcode like "BH17" than a full postcode).
 */
export async function searchParking(location: string, radius?: number, signal?: AbortSignal): Promise<SearchResponse> {
  const url = new URL('/api/parking/search', API_BASE_URL);
  url.searchParams.set('location', location);
  if (radius !== undefined) url.searchParams.set('radius', String(radius));

  const res = await fetch(url.toString(), { signal });
  const body = await res.json();

  if (!res.ok) {
    throw new ApiError(res.status, body as ApiErrorBody);
  }

  return body as SearchResponse;
}
