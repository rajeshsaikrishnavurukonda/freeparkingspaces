interface FooterProps {
  onShowPrivacyPolicy: () => void;
}

export function Footer({ onShowPrivacyPolicy }: FooterProps) {
  return (
    <footer className="app-footer">
      <button type="button" className="app-footer__link" onClick={onShowPrivacyPolicy}>
        Privacy &amp; Data Notice
      </button>
      <span className="app-footer__note">No accounts · No cookies · No tracking</span>
    </footer>
  );
}
