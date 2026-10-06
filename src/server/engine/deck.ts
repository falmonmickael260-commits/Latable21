import { randomUUID } from "crypto";
import type { Card, Rank, Suit } from "@/lib/types";

const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

/** Number of standard 52-card decks combined into one shoe. */
const DECKS_PER_SHOE = 6;
/** Reshuffle once the shoe drops below this many cards (the "cut card"). */
const RESHUFFLE_THRESHOLD = 52;

export function freshShoe(): Card[] {
  const cards: Card[] = [];
  for (let d = 0; d < DECKS_PER_SHOE; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ suit, rank, id: randomUUID() });
      }
    }
  }
  return shuffle(cards);
}

function shuffle(cards: Card[]): Card[] {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export class Shoe {
  private cards: Card[] = freshShoe();

  draw(): Card {
    if (this.cards.length <= RESHUFFLE_THRESHOLD) {
      this.cards = freshShoe();
    }
    const card = this.cards.pop();
    if (!card) throw new Error("Shoe unexpectedly empty");
    return card;
  }

  get remaining(): number {
    return this.cards.length;
  }
}

export function rankValue(rank: Rank): number {
  if (rank === "A") return 11;
  if (rank === "J" || rank === "Q" || rank === "K") return 10;
  return Number(rank);
}

/** Returns {total, soft} where soft=true means an Ace is counted as 11 and could drop to 1. */
export function handValue(cards: Card[]): { total: number; soft: boolean; isBlackjack: boolean } {
  let total = cards.reduce((sum, c) => sum + rankValue(c.rank), 0);
  let aces = cards.filter((c) => c.rank === "A").length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  const soft = cards.some((c) => c.rank === "A") && total <= 21 && aces > 0;
  const isBlackjack = cards.length === 2 && total === 21;
  return { total, soft, isBlackjack };
}

export function isBust(cards: Card[]): boolean {
  return handValue(cards).total > 21;
}
