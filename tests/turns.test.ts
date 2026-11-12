import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { GameManager } from "../src/server/game-manager";
import { store } from "../src/server/store";
import type { SeatState } from "../src/lib/types";

test("an expired turn stands without drawing and rejects late actions", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let drawn = 0;
  const game = new GameManager({ onTableUpdate() {}, onDealCard() { drawn++; }, onRoundResult() {}, onPlayerChanged() {} });
  const player = store.createPlayer("Timer", randomUUID());
  game.sit(4, player.id, player.pseudo);
  const table = game.getTable(), seat = table.seats[3];
  seat.hands = [{ id: "timer-hand", cards: [{ id: "a", rank: "5", suit: "clubs" }, { id: "b", rank: "6", suit: "hearts" }], bet: 100, status: "active", isSplit: false, isSplitAce: false, doubled: false, result: null, payout: 0 }];
  table.phase = "player_turns";
  const internal = game as unknown as { playHand(seat: SeatState, index: number): Promise<void> };
  const finished = internal.playHand(seat, 0);
  t.mock.timers.tick(120_000);
  await finished;
  assert.equal(seat.hands[0].status, "stood");
  assert.equal(drawn, 0);
  assert.throws(() => game.performAction(4, 0, player.id, "double"), /tour|terminée/);
  assert.equal(store.getById(player.id)!.balance, 3000);
});
