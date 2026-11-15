export function AstraLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label="ASTRA Health logo">
      <defs>
        <linearGradient id="astra-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="18.5" fill="#071226" stroke="#1a3159" />
      <ellipse cx="20" cy="20" rx="17" ry="7" fill="none" stroke="url(#astra-g)" strokeOpacity="0.55" transform="rotate(-24 20 20)" />
      <path
        d="M6 21h7l2.5-6 4 13 3.5-10 2 3h9"
        fill="none"
        stroke="url(#astra-g)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="33.5" cy="12" r="1.8" fill="#22d3ee" />
    </svg>
  );
}
