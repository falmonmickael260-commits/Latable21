import { randomUUID } from "crypto";
import type { Server as HTTPServer } from "http";
import { Server, type Socket } from "socket.io";
import { GameManager } from "./game-manager";
import { store } from "./store";
import type {
  ClientToServerEvents,
  PlayerPublic,
  ServerToClientEvents,
} from "@/lib/types";

type IOServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

function toPublic(playerId: string): PlayerPublic | null {
  const p = store.getById(playerId);
  if (!p) return null;
  return {
    id: p.id,
    pseudo: p.pseudo,
    balance: p.balance,
    nextBonusAt: store.nextBonusAt(p.id),
    totalWins: p.totalWins,
    totalLosses: p.totalLosses,
    totalBlackjacks: p.totalBlackjacks,
  };
}

let singleton: IOServer | null = null;

export function initSocketServer(httpServer: HTTPServer): IOServer {
  if (singleton) return singleton;

  const io: IOServer = new Server(httpServer, {
    path: "/socket.io",
  });
  singleton = io;

  const socketToPlayer = new Map<string, string>(); // socket.id -> playerId
  const playerToSockets = new Map<string, Set<string>>(); // playerId -> socket ids
  const lastPushedBalance = new Map<string, number>();

  const game = new GameManager({
    onTableUpdate: (table) => {
      io.emit("tableState", { table });
    },
    onDealCard: (target, card, order) => {
      io.emit("dealAnimation", { seatNumber: target.seatNumber, handIndex: target.handIndex, card, order });
    },
    onRoundResult: (results) => {
      io.emit("roundResult", { results });
    },
    onPlayerChanged: (playerId) => {
      pushPlayer(playerId);
    },
  });

  function pushPlayer(playerId: string) {
    const pub = toPublic(playerId);
    if (!pub) return;
    lastPushedBalance.set(playerId, pub.balance);
    const sockets = playerToSockets.get(playerId);
    if (!sockets) return;
    for (const sid of sockets) {
      io.to(sid).emit("playerUpdate", { player: pub });
    }
  }

  // Detects balance changes caused by the hourly bonus sweep (which runs
  // independently of any socket event) and pushes them to connected clients.
  setInterval(() => {
    for (const playerId of playerToSockets.keys()) {
      const p = store.getById(playerId);
      if (!p) continue;
      if (lastPushedBalance.get(playerId) !== p.balance) {
        pushPlayer(playerId);
      }
    }
  }, 5_000);

  io.on("connection", (socket: IOSocket) => {
    socket.on("identify", ({ pseudo, deviceToken }) => {
      try {
        let record = deviceToken ? store.getByDeviceToken(deviceToken) : undefined;
        if (!record) {
          const token = deviceToken ?? randomUUID();
          record = store.createPlayer(pseudo?.trim() || "JOUEUR", token);
        } else {
          store.touchLastSeen(record.id);
          if (pseudo?.trim() && pseudo.trim() !== record.pseudo) {
            store.renamePseudo(record.id, pseudo.trim());
          }
        }

        socketToPlayer.set(socket.id, record.id);
        if (!playerToSockets.has(record.id)) playerToSockets.set(record.id, new Set());
        playerToSockets.get(record.id)!.add(socket.id);

        const pub = toPublic(record.id);
        if (pub) {
          lastPushedBalance.set(record.id, pub.balance);
          socket.emit("identified", { player: pub, deviceToken: record.deviceToken });
        }
        socket.emit("tableState", { table: game.getTable() });
      } catch (err) {
        socket.emit("error", { message: (err as Error).message });
      }
    });

    socket.on("sit", ({ seatNumber }) => {
      guard(socket, socketToPlayer, (playerId) => {
        const player = store.getById(playerId);
        if (!player) throw new Error("Identifiez-vous d'abord.");
        game.sit(seatNumber, playerId, player.pseudo);
      });
    });

    socket.on("leaveSeat", ({ seatNumber }) => {
      guard(socket, socketToPlayer, (playerId) => game.leaveSeat(seatNumber, playerId));
    });

    socket.on("placeBet", ({ seatNumber, amount }) => {
      guard(socket, socketToPlayer, (playerId) => game.placeBet(seatNumber, playerId, amount));
    });

    socket.on("clearBet", ({ seatNumber }) => {
      guard(socket, socketToPlayer, (playerId) => game.clearBet(seatNumber, playerId));
    });

    socket.on("action", ({ seatNumber, handIndex, type }) => {
      guard(socket, socketToPlayer, (playerId) => game.performAction(seatNumber, handIndex, playerId, type));
    });

    socket.on("disconnect", () => {
      const playerId = socketToPlayer.get(socket.id);
      socketToPlayer.delete(socket.id);
      if (playerId) {
        const set = playerToSockets.get(playerId);
        set?.delete(socket.id);
        if (set && set.size === 0) playerToSockets.delete(playerId);
      }
    });
  });

  return io;
}

function guard(socket: IOSocket, map: Map<string, string>, fn: (playerId: string) => void) {
  const playerId = map.get(socket.id);
  if (!playerId) {
    socket.emit("error", { message: "Identifiez-vous d'abord." });
    return;
  }
  try {
    fn(playerId);
  } catch (err) {
    socket.emit("error", { message: (err as Error).message });
  }
}
