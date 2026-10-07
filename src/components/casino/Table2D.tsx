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

// Half-moon / fan shape — flat on the dealer's (far) side, one big round
// curve on the players' (near) side — like every real Blackjack table.
// The far edge is deliberately narrow and sits close to the top, while
// the curve's widest point and the near edge get the rest of the height:
// that asymmetry (compressed far side, expanded near side) is what reads
// as "looking down and across the table" instead of a flat plan-view
// shape — a 2D stand-in for real perspective foreshortening, since the
// scene has no actual 3D camera. Three nested paths (rail, gold ring,
// felt) at increasing insets, each hand-tuned to stay inside the 400x260
// viewBox.
const RAIL_PATH =
  "M 100,8 L 300,8 C 350,8 392,50 392,95 C 392,190 310,256 200,256 C 90,256 8,190 8,95 C 8,50 50,8 100,8 Z";
const RING_PATH =
  "M 112,20 L 288,20 C 336,20 378,62 378,97 C 378,178 300,240 200,240 C 100,240 22,178 22,97 C 22,62 64,20 112,20 Z";
const FELT_PATH =
  "M 124,32 L 276,32 C 320,32 364,74 364,99 C 364,168 290,226 200,226 C 110,226 36,168 36,99 C 36,74 80,32 124,32 Z";

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
          <radialGradient id="felt" cx="50%" cy="20%" r="85%">
            <stop offset="0%" stopColor="#1c5a40" />
            <stop offset="55%" stopColor="#0f3a28" />
            <stop offset="100%" stopColor="#08281b" />
          </radialGradient>
          {/* Far (top) edge reads darker/cooler, near (bottom) edge
              brighter — reinforces "the surface recedes into the
              distance" alongside the path's own foreshortening. */}
          <linearGradient id="feltDepth" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#000" stopOpacity="0.4" />
            <stop offset="35%" stopColor="#000" stopOpacity="0.08" />
            <stop offset="75%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#e8cf9a" stopOpacity="0.06" />
          </linearGradient>
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
        <path d={FELT_PATH} fill="url(#feltDepth)" />
        <path d={FELT_PATH} fill="none" stroke="#000" strokeOpacity="0.25" strokeWidth="1" />

        {/* Sits in the upper part of the felt, between the dealer's edge
            and the seat row below it — like every real table, the brand
            text lives above the betting spots, not below them. Compressed
            tighter than before: the perspective reshape above pulled the
            seat row higher up (closer to the dealer edge), leaving less
            vertical room here. */}
        <text
          x="200"
          y="54"
          textAnchor="middle"
          fontFamily="var(--font-display), Cinzel, serif"
          fontSize="20"
          fontWeight={700}
          letterSpacing="5"
          fill="#e8cf9a"
          fillOpacity="0.5"
        >
          BLACKJACK
        </text>
        <text
          x="200"
          y="72"
          textAnchor="middle"
          fontFamily="var(--font-display), Cinzel, serif"
          fontSize="13"
          fontWeight={700}
          letterSpacing="4"
          fill="#c9a24b"
          fillOpacity="0.5"
        >
          LA TABLE 21
        </text>
        <text
          x="200"
          y="85"
          textAnchor="middle"
          fontFamily="var(--font-body), sans-serif"
          fontSize="7"
          letterSpacing="3"
          fill="#e8cf9a"
          fillOpacity="0.38"
        >
          BLACKJACK EUROPÉEN
        </text>

        <text x="200" y="98" textAnchor="middle" fontSize="11" fillOpacity="0.32">
          <tspan fill="#e8cf9a">♠</tspan>
          <tspan dx="8" fill="#8a3b44">♥</tspan>
          <tspan dx="8" fill="#e8cf9a">♣</tspan>
          <tspan dx="8" fill="#8a3b44">♦</tspan>
        </text>

        <text
          x="200"
          y="111"
          textAnchor="middle"
          fontFamily="var(--font-body), sans-serif"
          fontSize="6.5"
          letterSpacing="1.5"
          fill="#cfc3aa"
          fillOpacity="0.38"
        >
          LE CROUPIER TIRE À 16 ET RESTE À 17
        </text>
        <text
          x="200"
          y="122"
          textAnchor="middle"
          fontFamily="var(--font-body), sans-serif"
          fontSize="6"
          letterSpacing="1.5"
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
