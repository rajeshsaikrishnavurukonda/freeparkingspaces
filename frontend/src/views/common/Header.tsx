import { Logo } from './Logo';

export function Header() {
  return (
    <header className="app-header">
      <div className="app-header__brand">
        <Logo size={44} />
        <div className="app-header__titles">
          <span className="app-header__title">UK Free Parking Finder</span>
          <span className="app-header__subtitle">Free parking, street bays &amp; time-limited spots near you</span>
        </div>
      </div>
    </header>
  );
}
