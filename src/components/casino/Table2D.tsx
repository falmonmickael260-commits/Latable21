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

// Half-moon / fan shape — flat on the dealer's side, one big round curve
// on the players' side — like every real Blackjack table (and every
// reference photo), instead of a full oval. Three nested paths (rail,
// gold ring, felt) at increasing insets, each hand-tuned to stay safely
// inside the 400x260 viewBox so nothing clips against its edges.
const RAIL_PATH =
  "M 82,8 L 318,8 C 370,8 398,95 398,145 C 398,205 320,256 200,256 C 80,256 2,205 2,145 C 2,95 30,8 82,8 Z";
const RING_PATH =
  "M 94,22 L 306,22 C 354,22 384,100 384,145 C 384,197 312,240 200,240 C 88,240 16,197 16,145 C 16,100 46,22 94,22 Z";
const FELT_PATH =
  "M 104,34 L 296,34 C 340,34 372,105 372,145 C 372,190 304,226 200,226 C 96,226 28,190 28,145 C 28,105 60,34 104,34 Z";

/**
 * A hand-drawn SVG table — half-moon felt, gold trim, wood rail, numbered
 * badges — inspired by real Blackjack tables (same palette, same brand
 * text, same badge layout) but built entirely in code, not a composited
 * photo.
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
          <radialGradient id="felt" cx="50%" cy="28%" r="80%">
            <stop offset="0%" stopColor="#1c5a40" />
            <stop offset="55%" stopColor="#0f3a28" />
            <stop offset="100%" stopColor="#08281b" />
          </radialGradient>
          <linearGradient id="rail" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4a2f1b" />
            <stop offset="30%" stopColor="#2a1a0e" />
            <stop offset="65%" stopColor="#1c1208" />
            <stop offset="100%" stopColor="#0d0804" />
          </linearGradient>
          <radialGradient id="railSheen" cx="38%" cy="12%" r="55%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.16" />
            <stop offset="60%" stopColor="#fff" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="goldRing" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f3e2b4" />
            <stop offset="45%" stopColor="#c9a24b" />
            <stop offset="100%" stopColor="#8a6a2c" />
          </linearGradient>
        </defs>

        {/* Leather rail: base gradient + a soft upper-left sheen so it
            reads as a padded, lit material instead of a flat fill. */}
        <path d={RAIL_PATH} fill="url(#rail)" />
        <path d={RAIL_PATH} fill="url(#railSheen)" />
        <path d={RING_PATH} fill="none" stroke="url(#goldRing)" strokeWidth="5" />
        <path d={RING_PATH} fill="none" stroke="#f8ecc8" strokeOpacity="0.5" strokeWidth="1" />
        <path d={FELT_PATH} fill="url(#felt)" />
        <path d={FELT_PATH} fill="none" stroke="#000" strokeOpacity="0.25" strokeWidth="1" />

        {/* Sits in the upper part of the felt, between the dealer's edge
            and the seat row below it — like every real table, the brand
            text lives above the betting spots, not below them. */}
        <text
          x="200"
          y="85"
          textAnchor="middle"
          fontFamily="var(--font-display), Cinzel, serif"
          fontSize="24"
          fontWeight={700}
          letterSpacing="6"
          fill="#e8cf9a"
          fillOpacity="0.5"
        >
          BLACKJACK
        </text>
        <text
          x="200"
          y="106"
          textAnchor="middle"
          fontFamily="var(--font-display), Cinzel, serif"
          fontSize="15"
          fontWeight={700}
          letterSpacing="5"
          fill="#c9a24b"
          fillOpacity="0.5"
        >
          LA TABLE 21
        </text>
        <text
          x="200"
          y="121"
          textAnchor="middle"
          fontFamily="var(--font-body), sans-serif"
          fontSize="8"
          letterSpacing="4"
          fill="#e8cf9a"
          fillOpacity="0.38"
        >
          BLACKJACK EUROPÉEN
        </text>

        <text x="200" y="136" textAnchor="middle" fontSize="13" fillOpacity="0.32">
          <tspan fill="#e8cf9a">♠</tspan>
          <tspan dx="10" fill="#8a3b44">♥</tspan>
          <tspan dx="10" fill="#e8cf9a">♣</tspan>
          <tspan dx="10" fill="#8a3b44">♦</tspan>
        </text>

        <text
          x="200"
          y="150"
          textAnchor="middle"
          fontFamily="var(--font-body), sans-serif"
          fontSize="7"
          letterSpacing="2"
          fill="#cfc3aa"
          fillOpacity="0.38"
        >
          LE CROUPIER TIRE À 16 ET RESTE À 17
        </text>
        <text
          x="200"
          y="161"
          textAnchor="middle"
          fontFamily="var(--font-body), sans-serif"
          fontSize="6.5"
          letterSpacing="2"
          fill="#cfc3aa"
          fillOpacity="0.32"
        >
          MIN 100 · MAX 500
        </text>

        {SEAT_BADGES.map(({ num, x, y }) => (
          <text
            key={num}
            x={x}
            y={y + 4}
            textAnchor="middle"
            fontFamily="var(--font-display), Cinzel, serif"
            fontSize="13"
            fontWeight={700}
            fill="#e8cf9a"
            opacity="0.8"
            style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.8))" }}
          >
            {num}
          </text>
        ))}
      </svg>
    </div>
  );
}
