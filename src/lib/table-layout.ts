// Design-space percentage layout for the hand-built 2D table (over the
// blurred photo backdrop) — built in code (SVG), not a composited photo.
// Deliberately compact: a real Blackjack table, not a giant oval bleeding
// off both screen edges. Seat 1 is the rightmost seat, seat 7 the
// leftmost — dealing in ascending seat order (the server's native order)
// therefore reads right-to-left on screen.

export interface Point {
  x: number; // percent of the stage width
  y: number; // percent of the stage height
}

// Dealer's feet sit right at the table's own flat top edge (stage y≈36,
// see RAIL_PATH's top edge in Table2D.tsx) — any lower and his legs sink
// visibly into the rail/felt instead of standing behind it, which reads
// as "floating on the table" rather than a dealer viewed in perspective
// behind it.
export const DEALER_POS: Point = { x: 50, y: 32 };
export const SHOE_POS: Point = { x: 50, y: 35 };

// A genuinely compact, deep table instead of a giant flat oval that bleeds
// off both screen edges — real blackjack tables (and every reference image)
// are a half-moon/fan shape: flat on the dealer's side, a big round curve
// on the players' side. Depth (TABLE_RADIUS.y) matters as much as width
// here — too flat and the seats have nowhere to sit without crowding the
// felt text; this is sized so the table fills its share of the stage
// instead of leaving a dead gap beneath a too-shallow sliver.
export const TABLE_CENTER: Point = { x: 50, y: 64 };
export const TABLE_RADIUS = { x: 34, y: 30 }; // percent — fits fully on screen

// A tight arc hugging the front curve of the (now much smaller, deeper)
// felt, seats a "shoulder width" apart rather than spread across most of
// the screen. Symmetric around seat 4 (center, closest to the viewer);
// seats curve back and in as they move outward toward 1 and 7.
export const SEAT_POSITIONS: Record<number, Point> = {
  1: { x: 73.26, y: 73.93 },
  2: { x: 67.63, y: 78.6 },
  3: { x: 59.49, y: 81.7 },
  4: { x: 50, y: 82.78 },
  5: { x: 40.51, y: 81.7 },
  6: { x: 32.37, y: 78.6 },
  7: { x: 26.74, y: 73.93 },
};

export function seatPosition(seatNumber: number): Point {
  return SEAT_POSITIONS[seatNumber] ?? { x: 50, y: 50 };
}

// A stool sits just outside the rail, directly in front of its seat — same
// x as the betting spot, offset further from the table center (larger y)
// so it reads as "in front of" the table edge rather than on the felt.
export function stoolPosition(seatNumber: number): Point {
  const p = seatPosition(seatNumber);
  return { x: p.x, y: p.y + 6.5 };
}
