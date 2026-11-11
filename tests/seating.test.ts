import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { GameManager } from "../src/server/game-manager";
import { store } from "../src/server/store";

const games: GameManager[] = [];
function setup() {
  const player = store.createPlayer("Test", randomUUID());
  const game = new GameManager({ onTableUpdate() {}, onDealCard() {}, onRoundResult() {}, onPlayerChanged() {} });
  games.push(game);
  return { game, player };
}
afterEach(() => {
  // Clear the real betting timers without exposing a test API in the engine.
  for (const game of games.splice(0)) {
    const timer = (game as unknown as { bettingTimer: NodeJS.Timeout | null }).bettingTimer;
    if (timer) clearTimeout(timer);
  }
});

test("a seated player can reserve and bet on several free cases", () => {
  const { game, player } = setup();
  game.sit(2, player.id, player.pseudo);
  game.sit(5, player.id, player.pseudo);
  game.placeBet(2, player.id, 100);
  game.placeBet(5, player.id, 200);
  assert.equal(player.balance, 2700);
  assert.deepEqual(game.getTable().seats.filter(s => s.playerId === player.id).map(s => s.seatNumber), [2, 5]);
  game.clearBet(2, player.id);
  assert.equal(player.balance, 2800);
  assert.equal(game.getTable().seats[4].hands[0].bet, 200);
});

test("occupied cases and unseated bets are rejected", () => {
  const { game, player } = setup();
  const other = store.createPlayer("Other", randomUUID());
  game.sit(4, player.id, player.pseudo);
  assert.throws(() => game.sit(4, other.id, other.pseudo), /occupée/);
  assert.throws(() => game.placeBet(3, other.id, 100), /assignée/);
  assert.throws(() => game.placeBet(4, other.id, 100), /assignée/);
  assert.equal(other.balance, 3000);
});

test("repeated bets cannot debit the balance twice", () => {
  const { game, player } = setup();
  game.sit(4, player.id, player.pseudo);
  game.placeBet(4, player.id, 100);
  assert.throws(() => game.placeBet(4, player.id, 200), /Annulez/);
  assert.equal(player.balance, 2900);
  assert.equal(game.getTable().seats[3].hands[0].bet, 100);
});

test("locked rounds reject leaving and cancelling bets", () => {
  const { game, player } = setup();
  game.sit(4, player.id, player.pseudo);
  game.placeBet(4, player.id, 100);
  game.getTable().phase = "dealing";
  assert.throws(() => game.leaveSeat(4, player.id), /fin de la manche/);
  assert.throws(() => game.clearBet(4, player.id), /fermées/);
  assert.throws(() => game.sit(5, player.id, player.pseudo), /en cours/);
  assert.equal(player.balance, 2900);
  assert.equal(game.getTable().seats[3].playerId, player.id);
});

test("invalid bet amounts leave balance and hand untouched", () => {
  const { game, player } = setup();
  game.sit(1, player.id, player.pseudo);
  for (const amount of [NaN, Infinity, 100.5, 0, 501]) assert.throws(() => game.placeBet(1, player.id, amount));
  assert.equal(player.balance, 3000);
  assert.equal(game.getTable().seats[0].hands.length, 0);
});
