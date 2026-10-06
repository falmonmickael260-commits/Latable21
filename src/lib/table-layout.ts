// Seat positions are fractions (0..1) of the photoreal table image itself
// (public/images/table-blackjack.png, 1774×887), read off its baked-in
// numbered badges — NOT percentages of the viewport. The image is rendered
// at a live-measured pixel box (see useImageBox), and every seat/card
// anchor is computed from that box + its fraction, so alignment holds at
// any viewport size.

export interface Fraction {
  fx: number;
  fy: number;
}

// Where cards visually originate from (dealer's hands, just above the
// table image) and where the dealer's own hand is laid out.
export const SHOE_FRACTION: Fraction = { fx: 0.5, fy: 0.0 };
export const DEALER_CARD_FRACTION: Fraction = { fx: 0.5, fy: 0.08 };

// Read directly off the table photo's gold numbered badges.
export const SEAT_FRACTIONS: Record<number, Fraction> = {
  1: { fx: 0.916, fy: 0.335 },
  2: { fx: 0.833, fy: 0.48 },
  3: { fx: 0.722, fy: 0.608 },
  4: { fx: 0.577, fy: 0.653 },
  5: { fx: 0.423, fy: 0.653 },
  6: { fx: 0.279, fy: 0.608 },
  7: { fx: 0.167, fy: 0.48 },
  8: { fx: 0.084, fy: 0.335 },
};

export function seatFraction(seatNumber: number): Fraction {
  return SEAT_FRACTIONS[seatNumber] ?? { fx: 0.5, fy: 0.5 };
}
