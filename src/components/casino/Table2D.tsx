"use client";

import { SEAT_POSITIONS, TABLE_CENTER, TABLE_RADIUS } from "@/lib/table-layout";

const VIEW_W = 400;
const VIEW_H = 260;

// Stage-space seat percentages projected into this SVG's local viewBox, so
// the drawn badges line up exactly with the (invisible) clickable hotspots
// the Seat components render on top.
const left = TABLE_CENTER.x - TABLE_RADIUS.x;
const top = TABLE_CENTER.y - TABLE_RADIUS.y;
const SEAT_BADGES = Object.entries(SEAT_POSITIONS).map(([num, pos]) => ({
  num,
  x: ((pos.x - left) / (TABLE_RADIUS.x * 2)) * VIEW_W,
  y: ((pos.y - top) / (TABLE_RADIUS.y * 2)) * VIEW_H,
}));

/**
 * A hand-drawn SVG table — oval felt, gold trim, wood rail, numbered
 * crowned badges — inspired by the reference photos (same palette, same
 * brand text, same badge layout) but built entirely in code, not a
 * composited photo.
 */
export function Table2D() {
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
      style={{
        left: `${TABLE_CENTER.x}%`,
        top: `${TABLE_CENTER.y}%`,
        width: `${TABLE_RADIUS.x * 2}%`,
        height: `${TABLE_RADIUS.y * 2}%`,
        filter: "drop-shadow(0 22px 34px rgba(0,0,0,0.55))",
      }}
    >
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} width="100%" height="100%" preserveAspectRatio="none">
        <defs>
          <radialGradient id="felt" cx="50%" cy="38%" r="75%">
            <stop offset="0%" stopColor="#1c5a40" />
            <stop offset="55%" stopColor="#0f3a28" />
            <stop offset="100%" stopColor="#08281b" />
          </radialGradient>
          <linearGradient id="rail" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3a2616" />
            <stop offset="55%" stopColor="#1c1208" />
            <stop offset="100%" stopColor="#0d0804" />
          </linearGradient>
          <linearGradient id="goldRing" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f3e2b4" />
            <stop offset="45%" stopColor="#c9a24b" />
            <stop offset="100%" stopColor="#8a6a2c" />
          </linearGradient>
        </defs>

        <ellipse cx="200" cy="130" rx="198" ry="128" fill="url(#rail)" />
        <ellipse cx="200" cy="130" rx="186" ry="118" fill="none" stroke="url(#goldRing)" strokeWidth="4" />
        <ellipse cx="200" cy="130" rx="179" ry="111" fill="url(#felt)" />
        <ellipse cx="200" cy="130" rx="179" ry="111" fill="none" stroke="#000" strokeOpacity="0.25" strokeWidth="1" />

        {/* Pushed below the (now higher/tighter) seat band so the brand
            block never collides with the seat circles above it — the
            table's flatter stretch (TABLE_RADIUS) moved that band up. */}
        <text
          x="200"
          y="143"
          textAnchor="middle"
          fontFamily="var(--font-display), Cinzel, serif"
          fontSize="26"
          fontWeight={700}
          letterSpacing="6"
          fill="#e8cf9a"
          fillOpacity="0.5"
        >
          BLACKJACK
        </text>
        <text
          x="200"
          y="166"
          textAnchor="middle"
          fontFamily="var(--font-display), Cinzel, serif"
          fontSize="16"
          fontWeight={700}
          letterSpacing="5"
          fill="#c9a24b"
          fillOpacity="0.5"
        >
          LA TABLE 21
        </text>
        <text
          x="200"
          y="182"
          textAnchor="middle"
          fontFamily="var(--font-body), sans-serif"
          fontSize="8"
          letterSpacing="4"
          fill="#e8cf9a"
          fillOpacity="0.38"
        >
          BLACKJACK EUROPÉEN
        </text>

        <text x="200" y="198" textAnchor="middle" fontSize="14" fillOpacity="0.32">
          <tspan fill="#e8cf9a">♠</tspan>
          <tspan dx="10" fill="#8a3b44">♥</tspan>
          <tspan dx="10" fill="#e8cf9a">♣</tspan>
          <tspan dx="10" fill="#8a3b44">♦</tspan>
        </text>

        <text
          x="200"
          y="212"
          textAnchor="middle"
          fontFamily="var(--font-body), sans-serif"
          fontSize="7"
          letterSpacing="2"
          fill="#cfc3aa"
          fillOpacity="0.38"
        >
          LE CROUPIER TIRE À 16 ET RESTE À 17
        </text>

        {SEAT_BADGES.map(({ num, x, y }) => (
          <g key={num} opacity="0.75">
            <circle cx={x} cy={y} r="15" fill="none" stroke="var(--gold-500, #c9a24b)" strokeWidth="1.2" />
            <path
              d={`M ${x - 5} ${y - 13} l 2.2 2 l 2.8 -3.4 l 2.8 3.4 l 2.2 -2 l -1 5.4 h -8 Z`}
              fill="#c9a24b"
              opacity="0.9"
            />
            <text
              x={x}
              y={y + 4}
              textAnchor="middle"
              fontFamily="var(--font-display), Cinzel, serif"
              fontSize="12"
              fontWeight={700}
              fill="#e8cf9a"
            >
              {num}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
