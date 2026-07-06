import { useMemo } from 'react';
import { useParkingSearchViewModel } from '../../viewmodels/useParkingSearchViewModel';
import { useUserLocation } from '../../hooks/useUserLocation';
import { haversineMeters } from '../../models/geo/distance';
import { SearchBar } from './SearchBar';
import { UserLocationControl } from './UserLocationControl';
import { ResultsList } from '../ResultsList/ResultsList';
import { MapView } from '../MapView/MapView';
import { Header } from '../common/Header';
import { Footer } from '../common/Footer';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorBanner } from '../common/ErrorBanner';

interface SearchPageProps {
  onShowPrivacyPolicy: () => void;
}

export function SearchPage({ onShowPrivacyPolicy }: SearchPageProps) {
  const { status, spots, resolvedLocation, meta, errorMessage, search } = useParkingSearchViewModel();
  const userLocation = useUserLocation();

  const orderedSpots = useMemo(() => {
    if (!userLocation.coords) return spots;
    const coords = userLocation.coords;
    return [...spots].sort((a, b) => haversineMeters(coords, a) - haversineMeters(coords, b));
  }, [spots, userLocation.coords]);

  return (
    <div className="search-page">
      <Header />

      <main className="search-page__main">
        <p className="disclaimer">
          Informational only — not a guarantee of free or legal parking. Restrictions change; always check on-site signage
          before leaving your vehicle.
        </p>

        <SearchBar onSearch={search} isLoading={status === 'loading'} />

        <UserLocationControl status={userLocation.status} errorMessage={userLocation.errorMessage} onRequestLocation={userLocation.requestLocation} />

        {status === 'loading' && <LoadingSpinner />}
        {status === 'error' && errorMessage && <ErrorBanner message={errorMessage} />}

        {status === 'success' && resolvedLocation && (
          <div className="search-page__results">
            <p className="resolved-location">
              Showing <strong>{spots.length}</strong> free parking {spots.length === 1 ? 'spot' : 'spots'} near{' '}
              <strong>{resolvedLocation.label}</strong>
              {meta?.warnings?.length ? <span className="warnings"> — {meta.warnings.join('; ')}</span> : null}
            </p>
            <div className="search-page__body">
              <ResultsList spots={orderedSpots} emptyMessage={meta?.notes} userLocation={userLocation.coords} />
              <MapView center={resolvedLocation} spots={orderedSpots} userLocation={userLocation.coords} />
            </div>
          </div>
        )}
      </main>

      <Footer onShowPrivacyPolicy={onShowPrivacyPolicy} />
    </div>
  );
}
