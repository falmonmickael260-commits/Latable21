"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { getStoredDeviceToken, storeDeviceToken, storePseudo } from "./device-token";
import type {
  Card,
  RoomSummary,
  ClientToServerEvents,
  PlayerPublic,
  RoundResultEntry,
  ServerToClientEvents,
  TableState,
} from "@/lib/types";

export interface DealEvent {
  seatNumber: number | "dealer";
  handIndex: number;
  card: Card;
  order: number;
  key: string;
}

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function useCasinoSocket(pseudo: string | null) {
  const socketRef = useRef<AppSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [player, setPlayer] = useState<PlayerPublic | null>(null);
  const [table, setTable] = useState<TableState | null>(null);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [currentRoomId, setCurrentRoomId] = useState("table-1");
  const [deviceRemembered, setDeviceRemembered] = useState(false);
  const [lastDeal, setLastDeal] = useState<DealEvent | null>(null);
  const [roundResults, setRoundResults] = useState<RoundResultEntry[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!pseudo) return;
    const socket: AppSocket = io({ path: "/socket.io" });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      let deviceToken: string | undefined;
      try { deviceToken = getStoredDeviceToken() ?? undefined; } catch {}
      socket.emit("identify", { pseudo, deviceToken });
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("identified", ({ player: p, deviceToken }) => {
      try { storeDeviceToken(deviceToken); storePseudo(p.pseudo); setDeviceRemembered(true); }
      catch { setDeviceRemembered(false); setErrorMessage("Le navigateur bloque la mémorisation du compte sur cet appareil."); }
      setPlayer(p);
    });
    socket.on("roomsState", ({ rooms: r }) => setRooms(r));
    socket.on("roomJoined", ({ roomId }) => { setCurrentRoomId(roomId); setRoundResults(null); setLastDeal(null); });
    socket.on("playerUpdate", ({ player: p }) => setPlayer(p));
    socket.on("tableState", ({ table: t }) => setTable(t));
    socket.on("dealAnimation", (payload) => {
      setLastDeal({ ...payload, key: `${payload.seatNumber}-${payload.order}-${payload.card.id}` });
    });
    socket.on("roundResult", ({ results }) => setRoundResults(results));
    socket.on("error", ({ message }) => setErrorMessage(message));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [pseudo]);

  const joinRoom = useCallback((roomId: string) => socketRef.current?.emit("joinRoom", { roomId }), []);
  const sit = useCallback((seatNumber: number) => socketRef.current?.emit("sit", { seatNumber }), []);
  const leaveSeat = useCallback((seatNumber: number) => socketRef.current?.emit("leaveSeat", { seatNumber }), []);
  const placeBet = useCallback(
    (seatNumber: number, amount: number) => socketRef.current?.emit("placeBet", { seatNumber, amount }),
    [],
  );
  const clearBet = useCallback((seatNumber: number) => socketRef.current?.emit("clearBet", { seatNumber }), []);
  const action = useCallback(
    (seatNumber: number, handIndex: number, type: "hit" | "stand" | "double" | "split") =>
      socketRef.current?.emit("action", { seatNumber, handIndex, type }),
    [],
  );

  const clearError = useCallback(() => setErrorMessage(null), []);
  const clearRoundResults = useCallback(() => setRoundResults(null), []);

  return {
    connected,
    rooms,
    currentRoomId,
    deviceRemembered,
    joinRoom,
    player,
    table,
    lastDeal,
    roundResults,
    errorMessage,
    sit,
    leaveSeat,
    placeBet,
    clearBet,
    action,
    clearError,
    clearRoundResults,
  };
}
