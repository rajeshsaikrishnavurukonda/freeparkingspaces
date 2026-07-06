import type { ParkingSpot } from '../../models/types/parkingSpot';
import type { Coordinates } from '../../models/geo/distance';
import { ParkingSpotCard } from './ParkingSpotCard';

interface ResultsListProps {
  spots: ParkingSpot[];
  emptyMessage?: string;
  userLocation: Coordinates | null;
}

export function ResultsList({ spots, emptyMessage, userLocation }: ResultsListProps) {
  if (spots.length === 0) {
    return <p className="results-list__empty">{emptyMessage || 'No free parking found nearby yet.'}</p>;
  }

  return (
    <ul className="results-list">
      {spots.map((spot) => (
        <ParkingSpotCard key={spot.id} spot={spot} userLocation={userLocation} />
      ))}
    </ul>
  );
}
