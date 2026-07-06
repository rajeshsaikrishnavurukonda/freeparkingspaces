import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import type { ParkingSpot, GeocodedLocation } from '../../models/types/parkingSpot';
import type { Coordinates } from '../../models/geo/distance';
import { describeParkingWindow } from '../../models/formatting/freeConditionsFormatter';
import { getDirectionsLinks } from '../../models/directions/buildDirectionsLinks';
import { haversineMeters, formatDistance } from '../../models/geo/distance';
import { useIsApplePlatform } from '../../hooks/useIsApplePlatform';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const defaultIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface MapViewProps {
  center: GeocodedLocation;
  spots: ParkingSpot[];
  userLocation: Coordinates | null;
}

export function MapView({ center, spots, userLocation }: MapViewProps) {
  const isApple = useIsApplePlatform();

  return (
    <MapContainer center={[center.lat, center.lng]} zoom={16} className="map-view" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {userLocation && (
        <CircleMarker
          center={[userLocation.lat, userLocation.lng]}
          radius={8}
          pathOptions={{ color: '#1a73e8', fillColor: '#1a73e8', fillOpacity: 0.8 }}
        >
          <Popup>Your location</Popup>
        </CircleMarker>
      )}
      {spots.map((spot) => {
        const parkingWindow = describeParkingWindow(spot.freeConditions);
        const directionsLinks = getDirectionsLinks(spot.lat, spot.lng, isApple);
        const distanceLabel = userLocation ? formatDistance(haversineMeters(userLocation, spot)) : null;

        return (
          <Marker key={spot.id} position={[spot.lat, spot.lng]} icon={defaultIcon}>
            <Popup>
              <strong>{spot.name || 'Free parking'}</strong>
              <br />
              {parkingWindow.headline}
              {distanceLabel && (
                <>
                  <br />
                  {distanceLabel} away
                </>
              )}
              <br />
              {directionsLinks.map((link, i) => (
                <span key={link.label}>
                  {i > 0 && ' · '}
                  <a href={link.url} target="_blank" rel="noopener noreferrer">
                    {link.label}
                  </a>
                </span>
              ))}
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
