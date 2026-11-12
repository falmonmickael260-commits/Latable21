import { randomUUID } from "node:crypto";
import type { Server as HTTPServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { z } from "zod";
import { CasinoRooms } from "./rooms";
import { store } from "./store";
import type { ClientToServerEvents, PlayerPublic, ServerToClientEvents } from "@/lib/types";

const seatNumberSchema = z.number().int().min(1).max(7);
const identifySchema = z.object({ pseudo: z.string().trim().min(1).max(16).optional(), deviceToken: z.string().max(200).optional(), roomId: z.string().max(40).optional() });
const roomSchema = z.object({ roomId: z.string().min(1).max(40) });
const seatSchema = z.object({ seatNumber: seatNumberSchema });
const betSchema = seatSchema.extend({ amount: z.number().int().min(100).max(500) });
const actionSchema = seatSchema.extend({ handIndex: z.number().int().min(0).max(1), type: z.enum(["hit", "stand", "double", "split"]) });

type IOServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
function toPublic(id: string): PlayerPublic | null {
  const p = store.getById(id);
  if (!p) return null;
  return { id: p.id, pseudo: p.pseudo, balance: p.balance, nextBonusAt: p.lastBonusAt + 3600000,
    totalWins: p.totalWins, totalLosses: p.totalLosses, totalBlackjacks: p.totalBlackjacks };
}
let singleton: IOServer | null = null;
export function initSocketServer(httpServer: HTTPServer): IOServer {
  if (singleton) return singleton;
  const io: IOServer = new Server(httpServer, { path: "/socket.io" });
  singleton = io;
  const socketToPlayer = new Map<string, string>();
  const socketToRoom = new Map<string, string>();
  const playerCurrentRoom = new Map<string, string>();
  const departureTimers = new Map<string, NodeJS.Timeout>();
  const playerToSockets = new Map<string, Set<string>>();
  const lastPushedBalance = new Map<string, number>();
  const topic = (id: string) => `casino:${id}`;
  const rooms = new CasinoRooms(id => ({
    onTableUpdate: table => { io.to(topic(id)).emit("tableState", { table }); io.emit("roomsState", { rooms: rooms.summaries() }); },
    onDealCard: (target, card, order) => io.to(topic(id)).emit("dealAnimation", { seatNumber: target.seatNumber, handIndex: target.handIndex, card, order }),
    onRoundResult: results => io.to(topic(id)).emit("roundResult", { results }),
    onPlayerChanged: pushPlayer,
  }));
  function pushPlayer(id: string) {
    const player = toPublic(id);
    if (!player) return;
    lastPushedBalance.set(id, player.balance);
    for (const sid of playerToSockets.get(id) ?? []) io.to(sid).emit("playerUpdate", { player });
  }
  function enter(socket: IOSocket, roomId: string) {
    rooms.game(roomId);
    const previous = socketToRoom.get(socket.id);
    if (previous) socket.leave(topic(previous));
    socketToRoom.set(socket.id, roomId);
    socket.join(topic(roomId));
    socket.emit("roomJoined", { roomId });
    socket.emit("tableState", { table: rooms.game(roomId).getTable() });
    socket.emit("roomsState", { rooms: rooms.summaries() });
  }
  function releaseDisconnected(id: string) {
    departureTimers.delete(id);
    if (playerToSockets.has(id)) return;
    const roomId = rooms.occupiedRoom(id);
    if (!roomId) return;
    const game = rooms.game(roomId), table = game.getTable();
    const seats = table.seats.filter(s => s.playerId === id);
    if (table.phase !== "idle" && table.phase !== "betting" && seats.some(s => s.hands.length > 0)) {
      const retry = setTimeout(() => releaseDisconnected(id), 5000); retry.unref(); departureTimers.set(id, retry); return;
    }
    for (const seat of seats) game.leaveSeat(seat.seatNumber, id);
  }
  const sweep = setInterval(() => {
    store.runBonusSweep();
    for (const id of playerToSockets.keys()) {
      const player = store.getById(id);
      if (player && lastPushedBalance.get(id) !== player.balance) pushPlayer(id);
    }
  }, 1000);
  sweep.unref();
  httpServer.on("close", () => { clearInterval(sweep); for (const timer of departureTimers.values()) clearTimeout(timer); });

  io.on("connection", socket => {
    socket.on("identify", payload => {
      try {
        const parsed = identifySchema.safeParse(payload);
        if (!parsed.success) throw new Error("Pseudo ou compte invalide.");
        const { pseudo, deviceToken, roomId } = parsed.data;
        if (socketToPlayer.has(socket.id)) throw new Error("Ce compte est déjà connecté.");
        let token = typeof deviceToken === "string" ? deviceToken : "";
        let record = token ? store.getByDeviceToken(token) : undefined;
        if (!record) { token = randomUUID(); record = store.createPlayer(pseudo?.trim() || "JOUEUR", token); }
        else {
          store.touchLastSeen(record.id);
          if (pseudo?.trim() && pseudo.trim() !== record.pseudo) store.renamePseudo(record.id, pseudo.trim());
        }
        const departure = departureTimers.get(record.id);
        if (departure) { clearTimeout(departure); departureTimers.delete(record.id); }
        socketToPlayer.set(socket.id, record.id);
        if (!playerToSockets.has(record.id)) playerToSockets.set(record.id, new Set());
        playerToSockets.get(record.id)!.add(socket.id);
        const player = toPublic(record.id)!;
        lastPushedBalance.set(player.id, player.balance);
        socket.emit("identified", { player, deviceToken: token });
        const restored = rooms.occupiedRoom(player.id);
        const selected = restored ?? playerCurrentRoom.get(player.id) ?? (rooms.games.has(roomId ?? "") ? roomId! : "table-1");
        playerCurrentRoom.set(player.id, selected);
        enter(socket, selected);
      } catch (error) { socket.emit("error", { message: (error as Error).message }); }
    });
    function guard(work: (id: string, roomId: string) => void) {
      const id = socketToPlayer.get(socket.id), roomId = socketToRoom.get(socket.id);
      if (!id || !roomId) { socket.emit("error", { message: "Ouvrez votre compte d’abord." }); return; }
      try { work(id, roomId); }
      catch (error) { socket.emit("error", { message: (error as Error).message }); }
    }
    function valid<T>(schema: z.ZodType<T>, payload: unknown, work: (data: T, id: string, roomId: string) => void) {
      const result = schema.safeParse(payload);
      if (!result.success) { socket.emit("error", { message: "Cette action n’est pas valide." }); return; }
      guard((id, roomId) => work(result.data, id, roomId));
    }
    socket.on("joinRoom", payload => valid(roomSchema, payload, ({ roomId }, id) => {
      rooms.releaseForSwitch(id, roomId);
      playerCurrentRoom.set(id, roomId);
      for (const sid of playerToSockets.get(id) ?? []) {
        const peer = io.sockets.sockets.get(sid);
        if (peer) enter(peer, roomId);
      }
    }));
    socket.on("sit", payload => valid(seatSchema, payload, ({ seatNumber }, id, roomId) => {
      const occupied = rooms.occupiedRoom(id);
      if (occupied && occupied !== roomId) throw new Error("Quittez votre autre table avant de vous asseoir.");
      const player = store.getById(id)!;
      rooms.game(roomId).sit(seatNumber, id, player.pseudo);
    }));
    socket.on("leaveSeat", payload => valid(seatSchema, payload, ({ seatNumber }, id, roomId) => rooms.game(roomId).leaveSeat(seatNumber, id)));
    socket.on("placeBet", payload => valid(betSchema, payload, ({ seatNumber, amount }, id, roomId) => rooms.game(roomId).placeBet(seatNumber, id, amount)));
    socket.on("clearBet", payload => valid(seatSchema, payload, ({ seatNumber }, id, roomId) => rooms.game(roomId).clearBet(seatNumber, id)));
    socket.on("action", payload => valid(actionSchema, payload, ({ seatNumber, handIndex, type }, id, roomId) => rooms.game(roomId).performAction(seatNumber, handIndex, id, type)));
    socket.on("disconnect", () => {
      const id = socketToPlayer.get(socket.id);
      socketToPlayer.delete(socket.id); socketToRoom.delete(socket.id);
      if (id) { playerToSockets.get(id)?.delete(socket.id); if (!playerToSockets.get(id)?.size) { playerToSockets.delete(id); playerCurrentRoom.delete(id); lastPushedBalance.delete(id);
          const departure = setTimeout(() => releaseDisconnected(id), 90000); departure.unref(); departureTimers.set(id, departure);
        } }
    });
  });
  return io;
}
