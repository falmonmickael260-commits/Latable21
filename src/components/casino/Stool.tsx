"use client";

/**
 * A small leather barstool silhouette, seen from slightly above and in
 * front — one per seat, sitting just outside the rail. Fixed-px, scaled
 * by the same reference-canvas transform as everything else on the table.
 */
export function Stool() {
  return (
    <svg width="30" height="22" viewBox="0 0 30 22" className="pointer-events-none select-none">
      <ellipse cx="15" cy="17" rx="9" ry="3.4" fill="#000" opacity="0.35" />
      <ellipse cx="15" cy="9.5" rx="11" ry="7" fill="url(#stoolLeather)" stroke="#8a6a2c" strokeWidth="0.8" />
      <ellipse cx="15" cy="7.5" rx="8.4" ry="5" fill="none" stroke="#c9a24b" strokeOpacity="0.45" strokeWidth="0.6" />
      <defs>
        <radialGradient id="stoolLeather" cx="40%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#4a1f26" />
          <stop offset="60%" stopColor="#2c1114" />
          <stop offset="100%" stopColor="#170809" />
        </radialGradient>
      </defs>
    </svg>
  );
}
