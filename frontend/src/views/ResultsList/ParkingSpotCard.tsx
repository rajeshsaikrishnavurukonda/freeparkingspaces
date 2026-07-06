import type { ParkingSpot } from '../../models/types/parkingSpot';
import type { Coordinates } from '../../models/geo/distance';
import { describeParkingWindow } from '../../models/formatting/freeConditionsFormatter';
import { getDirectionsLinks } from '../../models/directions/buildDirectionsLinks';
import { haversineMeters, formatDistance } from '../../models/geo/distance';
import { useIsApplePlatform } from '../../hooks/useIsApplePlatform';

const CONFIDENCE_LABEL: Record<ParkingSpot['confidence'], string> = {
  baseline: 'Baseline (OSM)',
  verified: 'Verified (council data)',
  'ai-inferred': 'AI-inferred',
};

const TYPE_LABEL: Record<ParkingSpot['type'], string> = {
  car_park: 'Car park',
  on_street_bay: 'On-street parking',
  free_after_hours_zone: 'Free after-hours zone',
  unknown: 'Parking',
};

interface ParkingSpotCardProps {
  spot: ParkingSpot;
  userLocation: Coordinates | null;
}

export function ParkingSpotCard({ spot, userLocation }: ParkingSpotCardProps) {
  const isApple = useIsApplePlatform();
  const parkingWindow = describeParkingWindow(spot.freeConditions);
  const directionsLinks = getDirectionsLinks(spot.lat, spot.lng, isApple);
  const distanceLabel = userLocation ? formatDistance(haversineMeters(userLocation, spot)) : null;

  return (
    <li className="parking-spot-card">
      <div className="parking-spot-card__header">
        <div className="parking-spot-card__title">
          <span className="parking-spot-card__type">{TYPE_LABEL[spot.type]}</span>
          {spot.name && <strong className="parking-spot-card__name">{spot.name}</strong>}
        </div>
        <div className="parking-spot-card__header-right">
          {distanceLabel && <span className="distance-badge">{distanceLabel} away</span>}
          <span className={`confidence-badge confidence-badge--${spot.confidence}`}>{CONFIDENCE_LABEL[spot.confidence]}</span>
        </div>
      </div>

      {spot.address && <div className="parking-spot-card__address">{spot.address}</div>}

      <div className="parking-spot-card__timings">
        <div className="parking-spot-card__headline">{parkingWindow.headline}</div>
        <div className="parking-spot-card__badges">
          {parkingWindow.durationLabel && <span className="pill pill--duration">{parkingWindow.durationLabel}</span>}
          {parkingWindow.maxStayLabel && <span className="pill pill--maxstay">{parkingWindow.maxStayLabel}</span>}
          {parkingWindow.dayBadges.map((day) => (
            <span key={day} className="pill pill--day">
              {day}
            </span>
          ))}
        </div>
        {parkingWindow.raw && <div className="parking-spot-card__notes">{parkingWindow.raw}</div>}
      </div>

      <div className="parking-spot-card__actions">
        {directionsLinks.map((link) => (
          <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer" className="directions-link">
            {link.label} ↗
          </a>
        ))}
      </div>

      <div className="parking-spot-card__meta">Last verified: {new Date(spot.lastVerified).toLocaleDateString()}</div>
    </li>
  );
}
