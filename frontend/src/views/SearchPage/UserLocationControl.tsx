import type { UserLocationStatus } from '../../hooks/useUserLocation';

interface UserLocationControlProps {
  status: UserLocationStatus;
  errorMessage: string | null;
  onRequestLocation: () => void;
}

export function UserLocationControl({ status, errorMessage, onRequestLocation }: UserLocationControlProps) {
  if (status === 'unsupported') return null;

  if (status === 'granted') {
    return <p className="user-location-control user-location-control--granted">📍 Showing distances from your current location</p>;
  }

  return (
    <div className="user-location-control">
      <button
        type="button"
        className="user-location-control__button"
        onClick={onRequestLocation}
        disabled={status === 'requesting'}
      >
        {status === 'requesting' ? 'Getting your location…' : '📍 Use my location to show distances'}
      </button>
      {status === 'denied' && (
        <span className="user-location-control__note">
          Location access wasn't granted — results still work, just without distances. {errorMessage ? `(${errorMessage})` : ''}
        </span>
      )}
      <span className="user-location-control__privacy-note">Stays in your browser — never sent to our server.</span>
    </div>
  );
}
