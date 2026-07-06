interface PrivacyPolicyProps {
  onBack: () => void;
}

export function PrivacyPolicy({ onBack }: PrivacyPolicyProps) {
  return (
    <div className="privacy-policy">
      <button type="button" className="privacy-policy__back" onClick={onBack}>
        ← Back to search
      </button>

      <h1>Privacy &amp; Data Notice</h1>
      <p className="privacy-policy__updated">Last updated: 2026-07-06</p>

      <section>
        <h2>What this app does with your data</h2>
        <p>
          This app has no user accounts, no cookies, and no analytics or tracking scripts. It doesn't store any personal
          data in a database — there isn't one. Here's exactly what happens with each piece of information you provide:
        </p>
      </section>

      <section>
        <h2>Location searches (postcode, place name)</h2>
        <p>
          When you search a location, the text you enter is sent to our backend, which forwards it to third-party
          geocoding services (see below) to resolve it into map coordinates, then queries free-parking data sources for
          that area. The search text and results are held briefly in server memory (an in-memory cache, typically
          15 minutes or less) purely to avoid re-querying the same area repeatedly — there is no database and nothing is
          retained after the server process restarts.
        </p>
      </section>

      <section>
        <h2>Your current location (optional)</h2>
        <p>
          If you click "Use my location", your browser will ask you to grant location permission — we never request
          this automatically. If you allow it:
        </p>
        <ul>
          <li>Your coordinates are read directly by your browser and used only in your browser to calculate distances.</li>
          <li>Your precise location is <strong>never sent to our server</strong> — all distance calculations happen locally on your device.</li>
          <li>Nothing is saved to cookies, local storage, or any persistent store — it exists only in memory for as long as the page is open.</li>
          <li>You can deny or revoke this permission at any time in your browser settings, and the app continues to work normally without it.</li>
        </ul>
      </section>

      <section>
        <h2>Third-party services we use</h2>
        <p>To provide search results, your search text (never your device location) may be sent to:</p>
        <ul>
          <li><strong>postcodes.io</strong> — UK postcode geocoding.</li>
          <li><strong>Nominatim (OpenStreetMap)</strong> — place-name geocoding.</li>
          <li><strong>Overpass API (OpenStreetMap)</strong> — free-parking location data.</li>
          <li><strong>data.gov.uk</strong> — UK council open datasets.</li>
        </ul>
        <p>Each of these is a separate data controller for the data you send them; please refer to their own privacy policies for details.</p>
      </section>

      <section>
        <h2>Your rights</h2>
        <p>
          Because we don't retain personal data beyond short-lived, non-identifying server caches, there is generally
          nothing tied to you to access, correct, or delete. If you have concerns about how a specific request was
          processed, the most effective action is simply not to grant location permission and to avoid using
          identifying details in your search text.
        </p>
      </section>
    </div>
  );
}
