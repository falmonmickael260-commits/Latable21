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

export const DEALER_POS: Point = { x: 50, y: 25 };
export const SHOE_POS: Point = { x: 50, y: 33 };

export const TABLE_CENTER: Point = { x: 50, y: 80 };
export const TABLE_RADIUS = { x: 62, y: 46 }; // percent — wide enough to run off both edges

export const SEAT_POSITIONS: Record<number, Point> = {
  1: { x: 92, y: 40 },
  2: { x: 80, y: 55 },
  3: { x: 65, y: 65 },
  4: { x: 56, y: 69 },
  5: { x: 44, y: 69 },
  6: { x: 35, y: 65 },
  7: { x: 20, y: 55 },
  8: { x: 8, y: 40 },
};

export function seatPosition(seatNumber: number): Point {
  return SEAT_POSITIONS[seatNumber] ?? { x: 50, y: 50 };
}
