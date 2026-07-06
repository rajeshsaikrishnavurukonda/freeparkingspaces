import { useCallback, useState } from 'react';
import type { Coordinates } from '../models/geo/distance';

export type UserLocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported';

interface UserLocationState {
  status: UserLocationStatus;
  coords: Coordinates | null;
  errorMessage: string | null;
}

/**
 * Wraps the browser Geolocation API behind an explicit opt-in call
 * (requestLocation) rather than requesting on mount — the user must take an
 * action before the permission prompt appears. Coordinates are held only in
 * React state: never persisted (no localStorage/cookies) and never sent to
 * our backend — all distance calculations happen entirely in the browser.
 */
export function useUserLocation() {
  const [state, setState] = useState<UserLocationState>({ status: 'idle', coords: null, errorMessage: null });

  const requestLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState({ status: 'unsupported', coords: null, errorMessage: 'Geolocation is not supported by this browser.' });
      return;
    }

    setState((prev) => ({ ...prev, status: 'requesting', errorMessage: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          status: 'granted',
          coords: { lat: position.coords.latitude, lng: position.coords.longitude },
          errorMessage: null,
        });
      },
      (error) => {
        setState({ status: 'denied', coords: null, errorMessage: error.message || 'Location permission was denied.' });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  return { ...state, requestLocation };
}
