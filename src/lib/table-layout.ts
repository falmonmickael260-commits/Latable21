// Design-space percentage layout for the hand-built 2D table (over the
// blurred photo backdrop). Shape and seat placement are matched precisely
// to the user's reference photo (7 betting circles, their exact relative
// arc spacing) — built in code (SVG), not the photo file itself. Seat 1 is
// the rightmost seat, seat 7 the leftmost — dealing in ascending seat order
// (the server's native order) therefore reads right-to-left on screen.

export interface Point {
  x: number; // percent of the stage width
  y: number; // percent of the stage height
}

// Dealer's feet sit right around the table's own top rail edge. Must stay
// large enough that DEALER_POS.y% of the *smallest* possible scene height
// (the 16:9 desktop case, refHeight=675) still clears the dealer sprite's
// fixed height (200px, see DealerMark) — otherwise its head gets clipped
// by the scene's overflow:hidden on wide/short viewports.
export const DEALER_POS: Point = { x: 50, y: 36 };
export const SHOE_POS: Point = { x: 50, y: 41 };

export const TABLE_CENTER: Point = { x: 50, y: 74 };
export const TABLE_RADIUS = { x: 72, y: 40 }; // percent — wide enough to run off both edges

// Read directly off the reference photo's numbered betting circles (same
// relative arc, 7 seats) — not approximated, the exact fractions.
export const SEAT_POSITIONS: Record<number, Point> = {
  1: { x: 85.5, y: 60 },
  2: { x: 75.7, y: 66.8 },
  3: { x: 63.7, y: 71.1 },
  4: { x: 49.7, y: 72.2 },
  5: { x: 36.0, y: 71.1 },
  6: { x: 23.9, y: 66.8 },
  7: { x: 14.1, y: 60 },
};

export function seatPosition(seatNumber: number): Point {
  return SEAT_POSITIONS[seatNumber] ?? { x: 50, y: 50 };
}
