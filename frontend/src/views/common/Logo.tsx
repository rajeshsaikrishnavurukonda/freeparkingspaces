export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ParkZen logo">
      <defs>
        <linearGradient id="logo-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1a73e8" />
          <stop offset="100%" stopColor="#1e9e5a" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill="url(#logo-gradient)" />
      <text x="18" y="32" fontFamily="system-ui, sans-serif" fontSize="24" fontWeight="700" fill="white">
        P
      </text>
      <circle cx="35" cy="14" r="5" fill="#ffffff" />
      <circle cx="35" cy="14" r="2.5" fill="#1e9e5a" />
    </svg>
  );
}
