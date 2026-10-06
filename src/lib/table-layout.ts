// Seat positions are fractions (0..1) of the full scene photo itself
// (public/images/table-scene.png, 1807×695 — table, dealer and room all
// baked into one image, cropped from the original 1807×870 reference to
// remove its baked-in mockup UI bars which duplicated our real HUD/
// buttons) read off its numbered betting circles — NOT percentages of the
// viewport. The image is rendered at its own natural aspect ratio at a
// live-measured pixel box (see useImageBox), and every seat/card anchor is
// computed from that box + its fraction, so alignment holds at any
// viewport size. Seat 1 is rightmost, seat 7 leftmost — dealing in
// ascending seat order (the server's native order) therefore reads
// right-to-left on screen, matching the image.

export interface Fraction {
  fx: number;
  fy: number;
}

export const IMAGE_WIDTH = 1807;
export const IMAGE_HEIGHT = 695;

// Where cards visually originate from (the dealer's hands over the chip
// tray) and where the dealer's own hand is laid out once dealt.
export const SHOE_FRACTION: Fraction = { fx: 0.497, fy: 0.322 };
export const DEALER_CARD_FRACTION: Fraction = { fx: 0.497, fy: 0.36 };

// Read directly off the photo's numbered betting circles.
export const SEAT_FRACTIONS: Record<number, Fraction> = {
  1: { fx: 0.8551, fy: 0.6 },
  2: { fx: 0.7572, fy: 0.668 },
  3: { fx: 0.6365, fy: 0.711 },
  4: { fx: 0.497, fy: 0.722 },
  5: { fx: 0.3598, fy: 0.711 },
  6: { fx: 0.2391, fy: 0.668 },
  7: { fx: 0.1411, fy: 0.6 },
};

export function seatFraction(seatNumber: number): Fraction {
  return SEAT_FRACTIONS[seatNumber] ?? { fx: 0.5, fy: 0.5 };
}
