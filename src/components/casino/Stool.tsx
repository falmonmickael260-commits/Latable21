"use client";

/**
 * A red-leather, gold-trimmed chair back — one per seat, facing the camera
 * from just outside the rail. Sized to actually read as furniture (not a
 * tiny decorative dot): real tables are "framed" by a visible row of
 * chairs, which is also what fills the space between the felt and the
 * bottom UI dock instead of leaving it empty.
 */
export function Stool() {
  return (
    <svg width="58" height="64" viewBox="0 0 58 64" className="pointer-events-none select-none">
      <defs>
        <linearGradient id="chairLeather" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#5a1f28" />
          <stop offset="45%" stopColor="#3a1217" />
          <stop offset="100%" stopColor="#220a0d" />
        </linearGradient>
        <radialGradient id="chairSheen" cx="35%" cy="15%" r="60%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="29" cy="60" rx="21" ry="4" fill="#000" opacity="0.4" />

      {/* Frame */}
      <rect x="4" y="6" width="50" height="48" rx="16" fill="#1c1208" stroke="#8a6a2c" strokeWidth="1.2" />
      {/* Leather panel */}
      <rect x="9" y="11" width="40" height="38" rx="12" fill="url(#chairLeather)" />
      <rect x="9" y="11" width="40" height="38" rx="12" fill="url(#chairSheen)" />
      {/* Tufted buttons */}
      <circle cx="19" cy="22" r="1.4" fill="#120608" opacity="0.8" />
      <circle cx="39" cy="22" r="1.4" fill="#120608" opacity="0.8" />
      <circle cx="29" cy="30" r="1.4" fill="#120608" opacity="0.8" />
      <circle cx="19" cy="39" r="1.4" fill="#120608" opacity="0.8" />
      <circle cx="39" cy="39" r="1.4" fill="#120608" opacity="0.8" />

      {/* Crown medallion */}
      <g transform="translate(29,8)">
        <circle r="6.5" fill="#1c1208" stroke="#c9a24b" strokeWidth="1" />
        <path
          d="M -3.4 1.6 L -2.2 -1.8 L -0.9 0.6 L 0 -2.2 L 0.9 0.6 L 2.2 -1.8 L 3.4 1.6 Z"
          fill="#d9b876"
        />
      </g>

      {/* Armrests */}
      <rect x="0" y="30" width="8" height="18" rx="4" fill="#1c1208" stroke="#8a6a2c" strokeWidth="1" />
      <rect x="50" y="30" width="8" height="18" rx="4" fill="#1c1208" stroke="#8a6a2c" strokeWidth="1" />
    </svg>
  );
}
