"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { PlayerPublic } from "@/lib/types";

function formatCountdown(ms: number) {
  if (ms <= 0) return "00:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function HUD({ player, connected }: { player: PlayerPublic | null; connected: boolean }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="absolute top-0 left-0 right-0 z-20 flex items-start justify-between p-4 sm:p-6">
      <div className="flex items-center gap-2.5 rounded-full px-4 py-2 backdrop-blur-sm" style={{ background: "rgba(5,8,10,0.55)", border: "1px solid rgba(217,184,118,0.25)" }}>
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
          style={{ background: "var(--gold-500)", color: "var(--ink)" }}
        >
          {player?.pseudo?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-[12px] tracking-wide" style={{ fontFamily: "var(--font-display)", color: "var(--cream)" }}>
            {player?.pseudo ?? "—"}
          </span>
          <span className="text-[9px] uppercase tracking-widest" style={{ color: connected ? "var(--felt-text)" : "var(--wine-500)" }}>
            {connected ? "connecté" : "connexion…"}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1.5">
        <motion.div
          key={player?.balance}
          initial={{ scale: 1.15 }}
          animate={{ scale: 1 }}
          className="flex items-center gap-2 rounded-full px-4 py-2 backdrop-blur-sm"
          style={{ background: "rgba(5,8,10,0.55)", border: "1px solid rgba(217,184,118,0.25)" }}
        >
          <span className="text-[16px]" aria-hidden>
            🪙
          </span>
          <span className="text-[15px] font-semibold tabular-nums text-gold-gradient" style={{ fontFamily: "var(--font-display)" }}>
            {player?.balance ?? 0}
          </span>
        </motion.div>
        <div className="flex flex-col items-end rounded-full px-3 py-1" style={{ background: "rgba(5,8,10,0.4)" }}>
          <span className="text-[8px] uppercase tracking-[0.2em]" style={{ color: "var(--cream-dim)" }}>
            Prochain bonus · +3000
          </span>
          <span className="text-[11px] tabular-nums" style={{ color: "var(--gold-400)" }}>
            {player ? formatCountdown(player.nextBonusAt - now) : "--:--:--"}
          </span>
        </div>
      </div>
    </div>
  );
}
