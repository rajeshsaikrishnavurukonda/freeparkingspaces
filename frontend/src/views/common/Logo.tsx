export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ParkZen logo">
      <defs>
        <linearGradient id="logo-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="55%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill="url(#logo-gradient)" />
      <text
        x="24"
        y="32"
        fontFamily="system-ui, -apple-system, Segoe UI, sans-serif"
        fontSize="20"
        fontWeight="800"
        letterSpacing="-0.5"
        fill="white"
        textAnchor="middle"
      >
        PZ
      </text>
    </svg>
  );
}
