"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { RoundResultEntry } from "@/lib/types";
import { sfx } from "@/lib/sound";

interface ResultBannerProps {
  results: RoundResultEntry[] | null;
  mySeatNumbers: number[];
  dealerBusted: boolean;
}

const PRIORITY: Record<string, number> = { blackjack: 3, win: 2, push: 1, lose: 0, bust: 0 };

export function ResultBanner({ results, mySeatNumbers, dealerBusted }: ResultBannerProps) {
  const [headline, setHeadline] = useState<{ text: string; tone: "gold" | "dealerBust" } | null>(null);

  useEffect(() => {
    if (!results || results.length === 0) return;
    const mine = results.filter((r) => mySeatNumbers.includes(r.seatNumber));
    const pool = mine.length > 0 ? mine : results;
    const best = pool.reduce((a, b) => (PRIORITY[b.result ?? ""] > PRIORITY[a.result ?? ""] ? b : a));

    // Reacting to a server-pushed round result by flashing a transient
    // celebratory banner + sound — a genuine effect (external event → side
    // effect), not a value derivable from props during render.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (best.result === "blackjack") {
      sfx.blackjack();
      setHeadline({ text: "BLACKJACK !", tone: "gold" });
    } else if (dealerBusted && (mine.length > 0 ? mine : results).some((r) => r.result === "win")) {
      sfx.win();
      setHeadline({ text: "CROUPIER BUST !", tone: "dealerBust" });
    } else if (best.result === "win" && mine.length > 0) {
      sfx.win();
      setHeadline({ text: "VICTOIRE", tone: "gold" });
    } else if (mine.length > 0 && mine.every((r) => r.result === "lose" || r.result === "bust")) {
      sfx.lose();
      setHeadline(null);
    } else {
      setHeadline(null);
    }
    /* eslint-enable react-hooks/set-state-in-effect */

    const timeout = setTimeout(() => setHeadline(null), 2400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, dealerBusted]);

  const isDealerBust = headline?.tone === "dealerBust";

  return (
    <AnimatePresence>
      {headline && (
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.1 }}
          className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none"
        >
          <motion.span
            animate={{
              textShadow: isDealerBust
                ? ["0 0 20px rgba(167,45,58,0.5)", "0 0 55px rgba(217,184,118,0.85)", "0 0 20px rgba(167,45,58,0.5)"]
                : ["0 0 20px rgba(217,184,118,0.4)", "0 0 60px rgba(217,184,118,0.9)", "0 0 20px rgba(217,184,118,0.4)"],
            }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className={isDealerBust ? "font-black tracking-widest" : "text-gold-gradient font-black tracking-widest"}
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2.2rem, 7vw, 5.2rem)",
              ...(isDealerBust
                ? {
                    background: "linear-gradient(180deg, #f3e2b4 0%, #d9b876 35%, #a7303f 75%, #7a1f2b 100%)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }
                : {}),
            }}
          >
            {headline.text}
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
