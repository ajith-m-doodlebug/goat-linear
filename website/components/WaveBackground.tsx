export function WaveBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {/* Gradient mesh */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(37, 99, 235, 0.25), transparent 60%), radial-gradient(ellipse 60% 40% at 80% 60%, rgba(6, 182, 212, 0.2), transparent 50%)",
        }}
      />
      <svg
        className="absolute bottom-0 left-0 w-full min-h-[400px] opacity-90"
        viewBox="0 0 1200 400"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="waveGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e3a8a" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#2563eb" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="waveGrad2" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#e0f2fe" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        <path
          fill="url(#waveGrad1)"
          d="M0,200 Q300,80 600,180 T1200,220 L1200,400 L0,400 Z"
        />
        <path
          fill="url(#waveGrad2)"
          d="M0,280 Q400,160 800,260 T1600,300 L1600,400 L0,400 Z"
        />
      </svg>
      {/* Soft orbs */}
      <div className="absolute top-20 left-1/4 w-64 h-64 rounded-full bg-primary/10 blur-3xl animate-float" />
      <div className="absolute top-40 right-1/4 w-48 h-48 rounded-full bg-accent/15 blur-3xl animate-float" style={{ animationDelay: "-2s" }} />
    </div>
  );
}
