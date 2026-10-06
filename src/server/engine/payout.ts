import type { HandResult } from "@/lib/types";

/** Total amount credited back to the player for a settled hand (0 on loss/bust). */
export function payoutFor(result: HandResult, bet: number): number {
  switch (result) {
    case "blackjack":
      return Math.round(bet * 2.5); // bet returned + 3:2 profit
    case "win":
      return bet * 2; // bet returned + 1:1 profit
    case "push":
      return bet; // bet returned, no profit
    case "lose":
    case "bust":
    case null:
    default:
      return 0;
  }
}
