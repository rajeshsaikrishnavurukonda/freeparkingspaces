import { useCallback, useRef, useState } from 'react';
import { searchParking, ApiError } from '../models/api/parkingApiClient';
import type { ParkingSpot, GeocodedLocation, SearchMeta } from '../models/types/parkingSpot';

type Status = 'idle' | 'loading' | 'success' | 'error';

interface State {
  status: Status;
  spots: ParkingSpot[];
  resolvedLocation: GeocodedLocation | null;
  meta: SearchMeta | null;
  errorMessage: string | null;
}

const ERROR_MESSAGES: Record<string, string> = {
  MISSING_LOCATION: 'Please enter a location to search.',
  LOCATION_NOT_FOUND: "We couldn't find that location — try a full postcode or a more specific place name.",
  INTERNAL_ERROR: 'Something went wrong. Please try again.',
};

export function useParkingSearchViewModel() {
  const [state, setState] = useState<State>({
    status: 'idle',
    spots: [],
    resolvedLocation: null,
    meta: null,
    errorMessage: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (location: string) => {
    const trimmed = location.trim();
    if (!trimmed) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((prev) => ({ ...prev, status: 'loading', errorMessage: null }));

    try {
      const result = await searchParking(trimmed, undefined, controller.signal);
      setState({
        status: 'success',
        spots: result.spots,
        resolvedLocation: result.resolvedLocation,
        meta: result.meta,
        errorMessage: null,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;

      const message =
        err instanceof ApiError ? ERROR_MESSAGES[err.body.error] || err.body.message : 'Network error — please try again.';

      setState({
        status: 'error',
        spots: [],
        resolvedLocation: null,
        meta: null,
        errorMessage: message,
      });
    }
  }, []);

  return { ...state, search };
}
