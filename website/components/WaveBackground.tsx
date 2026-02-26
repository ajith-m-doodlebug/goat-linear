export function WaveBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <svg
        className="absolute bottom-0 left-0 w-full h-full text-accent-light/40"
        viewBox="0 0 1200 400"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e0f2fe" />
            <stop offset="100%" stopColor="#bae6fd" />
          </linearGradient>
        </defs>
        <path
          fill="url(#waveGrad)"
          d="M0,200 Q300,100 600,200 T1200,200 L1200,400 L0,400 Z"
          opacity="0.6"
        />
        <path
          fill="url(#waveGrad)"
          d="M0,250 Q400,150 800,250 T1600,250 L1600,400 L0,400 Z"
          opacity="0.4"
        />
      </svg>
    </div>
  );
}
