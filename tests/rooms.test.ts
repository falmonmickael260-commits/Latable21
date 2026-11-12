import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { CasinoRooms } from "../src/server/rooms";
import { store } from "../src/server/store";
const instances: CasinoRooms[] = [];
function setup() {
  const rooms = new CasinoRooms(() => ({ onTableUpdate() {}, onDealCard() {}, onRoundResult() {}, onPlayerChanged() {} }));
  instances.push(rooms); return { rooms, player: store.createPlayer("Room", randomUUID()) };
}
afterEach(() => { for (const rooms of instances.splice(0)) for (const game of rooms.games.values()) {
  const timer = (game as unknown as { bettingTimer: NodeJS.Timeout | null }).bettingTimer; if (timer) clearTimeout(timer);
} });

test("rooms have independent seats and summaries use actual occupancy", () => {
  const { rooms, player } = setup();
  rooms.game("table-1").sit(3, player.id, player.pseudo);
  rooms.game("table-1").sit(4, player.id, player.pseudo);
  const list = rooms.summaries();
  assert.equal(list[0].occupiedSeats, 2); assert.equal(list[0].players, 1);
  assert.equal(list[1].occupiedSeats, 0); assert.equal(rooms.game("table-2").getTable().seats[2].status, "empty");
});
test("switching rooms refunds open bets and frees the previous cases", () => {
  const { rooms, player } = setup(); const game = rooms.game("table-1");
  game.sit(4, player.id, player.pseudo); game.placeBet(4, player.id, 200);
  rooms.releaseForSwitch(player.id, "table-2");
  assert.equal(store.getById(player.id)!.balance, 3000);
  assert.equal(game.getTable().seats[3].status, "empty");
  assert.throws(() => rooms.releaseForSwitch(player.id, "missing"));
});
test("an active wager locks its room until the round finishes", () => {
  const { rooms, player } = setup(); const game = rooms.game("table-1");
  game.sit(4, player.id, player.pseudo); game.placeBet(4, player.id, 100); game.getTable().phase = "player_turns";
  assert.throws(() => rooms.releaseForSwitch(player.id, "table-2"), /Terminez/);
  assert.equal(rooms.occupiedRoom(player.id), "table-1");
  assert.equal(store.getById(player.id)!.balance, 2900);
});
