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

// Dealer's feet sit right at the table's own flat top edge (see
// RAIL_PATH's top edge in Table2D.tsx, converted to stage % below) — any
// lower and his legs sink visibly into the rail/felt instead of standing
// behind it, which reads as "floating on the table" rather than a dealer
// viewed in perspective behind it.
export const DEALER_POS: Point = { x: 50, y: 22 };
export const SHOE_POS: Point = { x: 50, y: 25 };

// A genuinely compact, deep table instead of a giant flat oval that bleeds
// off both screen edges — real blackjack tables (and every reference image)
// are a half-moon/fan shape: flat on the dealer's side, a big round curve
// on the players' side. Wide on x so the near (bottom) edge reaches close
// to the stage's own edges (a narrow table with empty side margins reads
// as "floating/tiny" on a phone), and deep on y so the whole composition
// (dealer + table) actually fills a tall phone's available height instead
// of being pinned to a short box under the HUD with dead space below it —
// the stage's own aspect ratio (MIN_RATIO in CasinoTable.tsx) stretches
// this box non-uniformly on portrait screens, so TABLE_RADIUS needs to
// already be close to the box's natural shape there or the felt distorts
// into a narrow point instead of staying a wide curve.
export const TABLE_CENTER: Point = { x: 50, y: 60 };
export const TABLE_RADIUS = { x: 44, y: 38 }; // percent — fits fully on screen

// Seats are stored as fractions of TABLE_RADIUS (not raw stage percent) so
// resizing the table (TABLE_RADIUS) can't silently knock every seat off the
// felt's curve — each seat is defined by where it sits relative to the
// table, not an absolute screen position. Symmetric around seat 4 (center,
// closest to the viewer); seats curve back and in as they move outward
// toward 1 and 7. Fractions were derived to land just inside the felt's own
// curve (see FELT_PATH in Table2D.tsx) — going much past these pushes the
// outer seats onto the gold rim.
const SEAT_FRACTIONS: Record<number, Point> = {
  1: { x: 0.625, y: 0.1253 },
  2: { x: 0.46, y: 0.385 },
  3: { x: 0.26, y: 0.532 },
  4: { x: 0, y: 0.5923 },
  5: { x: -0.26, y: 0.532 },
  6: { x: -0.46, y: 0.385 },
  7: { x: -0.625, y: 0.1253 },
};

export const SEAT_POSITIONS: Record<number, Point> = Object.fromEntries(
  Object.entries(SEAT_FRACTIONS).map(([seat, f]) => [
    seat,
    { x: TABLE_CENTER.x + f.x * TABLE_RADIUS.x, y: TABLE_CENTER.y + f.y * TABLE_RADIUS.y },
  ])
) as Record<number, Point>;

export function seatPosition(seatNumber: number): Point {
  return SEAT_POSITIONS[seatNumber] ?? { x: 50, y: 50 };
}

// A stool sits just outside the rail, directly in front of its seat — same
// x as the betting spot, offset further from the table center (larger y)
// so it reads as "in front of" the table edge rather than on the felt.
export function stoolPosition(seatNumber: number): Point {
  const p = seatPosition(seatNumber);
  return { x: p.x, y: p.y + 22 };
}
