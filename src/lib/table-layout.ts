// Design-space percentage layout, now anchored to the real background photo
// (public/images/table-bg.png, 941x1672 native) instead of a hand-built SVG
// table. Everything below is measured directly off that image (as % of its
// own width/height) — the whole scene is displayed via a strict "contain"
// fit (see CasinoTable.tsx's IMAGE_ASPECT), so these percentages always
// line up with the actual photo pixels regardless of viewport size. Seat 1
// is the rightmost seat, seat 7 the leftmost — dealing in ascending seat
// order (the server's native order) therefore reads right-to-left on
// screen, matching the photo's own printed numbering.

export interface Point {
  x: number; // percent of the background image's width
  y: number; // percent of the background image's height
}

// Native pixel size of public/images/table-bg.png — defines the fixed
// aspect ratio the whole scene is "contain" fit to (see CasinoTable.tsx).
export const IMAGE_WIDTH = 941;
export const IMAGE_HEIGHT = 1672;

// Where the dealer's hands rest on the felt — dealt dealer cards land here.
export const DEALER_POS: Point = { x: 42.5, y: 39 };
// The card shoe prop (top right) — card-flight animations originate here.
export const SHOE_POS: Point = { x: 74.5, y: 42 };

// Measured directly off the betting circles' gold rings in the photo.
export const SEAT_POSITIONS: Record<number, Point> = {
  1: { x: 78.9, y: 53.7 },
  2: { x: 68.9, y: 56.9 },
  3: { x: 56.2, y: 59.1 },
  4: { x: 42.4, y: 60.2 },
  5: { x: 28.9, y: 59.1 },
  6: { x: 16.5, y: 56.9 },
  7: { x: 6.4, y: 53.8 },
};

export function seatPosition(seatNumber: number): Point {
  return SEAT_POSITIONS[seatNumber] ?? { x: 50, y: 50 };
}
