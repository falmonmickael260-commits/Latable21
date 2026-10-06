// Design-space percentage layout for the hand-built 2D table (over the
// blurred photo backdrop). Close, low "seated player" camera framing — the
// table is large and elongated, filling most of the frame. All 8 seats sit
// on a single arc facing the dealer, like a real blackjack table. Seat 1 is
// the rightmost seat, seat 8 the leftmost — dealing in ascending seat order
// (the server's native order) therefore reads right-to-left on screen.

export interface Point {
  x: number; // percent of the stage width
  y: number; // percent of the stage height
}

// Dealer's feet sit right at the table's own top rail edge (TABLE_CENTER.y
// - TABLE_RADIUS.y = 34) — close enough to read as standing right at the
// table rather than floating above it.
export const DEALER_POS: Point = { x: 50, y: 33 };
export const SHOE_POS: Point = { x: 50, y: 38 };

export const TABLE_CENTER: Point = { x: 50, y: 80 };
export const TABLE_RADIUS = { x: 66, y: 46 }; // percent — wide enough to run off both edges

// Tuned so seat 1/8 (the widest) land almost exactly on the gold rim
// (solving the ellipse equation for TABLE_CENTER/TABLE_RADIUS above) —
// previously they sat noticeably outside it.
export const SEAT_POSITIONS: Record<number, Point> = {
  1: { x: 87, y: 42 },
  2: { x: 77, y: 56 },
  3: { x: 64, y: 66 },
  4: { x: 55, y: 70 },
  5: { x: 45, y: 70 },
  6: { x: 36, y: 66 },
  7: { x: 23, y: 56 },
  8: { x: 13, y: 42 },
};

export function seatPosition(seatNumber: number): Point {
  return SEAT_POSITIONS[seatNumber] ?? { x: 50, y: 50 };
}
