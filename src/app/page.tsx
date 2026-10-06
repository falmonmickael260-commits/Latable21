"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { getStoredPseudo, storePseudo } from "@/lib/device-token";

export default function LandingPage() {
  const router = useRouter();
  const [pseudo, setPseudo] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const stored = getStoredPseudo();
    // One-time sync from localStorage (an external store) on mount — not a
    // derived value, so this doesn't qualify for a lazy useState initializer
    // without causing an SSR/client hydration mismatch on the input value.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setPseudo(stored);
  }, []);

  const trimmed = pseudo.trim();
  const valid = trimmed.length >= 2 && trimmed.length <= 16;

  function enter() {
    setTouched(true);
    if (!valid) return;
    storePseudo(trimmed);
    router.push("/table");
  }

  return (
    <div className="relative flex-1 flex items-end justify-center overflow-hidden">
      <Image
        src="/images/la-table-21-hero.png"
        alt=""
        fill
        priority
        className="object-cover"
        style={{ objectPosition: "center 30%" }}
        sizes="100vw"
      />
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(180deg, rgba(3,4,5,0.1) 0%, rgba(3,4,5,0.25) 55%, rgba(3,4,5,0.88) 100%)" }}
      />

      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative z-10 mb-[6%] flex flex-col items-center gap-7 px-8 py-10 rounded-2xl"
        style={{ border: "1px solid rgba(217,184,118,0.3)", background: "rgba(5,8,10,0.55)", backdropFilter: "blur(10px)" }}
      >
        <div className="flex flex-col items-center gap-2">
          <h1
            className="text-gold-gradient text-center font-black tracking-wide"
            style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.4rem, 3.4vw, 2.2rem)" }}
          >
            Bienvenue à la table
          </h1>
          <p className="text-[12px] text-center max-w-[320px]" style={{ color: "var(--cream-dim)" }}>
            Choisissez votre pseudonyme pour entrer dans la salle. Votre place reste la vôtre à chaque retour.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 w-full">
          <label className="text-[10px] uppercase tracking-[0.3em]" style={{ color: "var(--cream-dim)" }}>
            Pseudo
          </label>
          <input
            autoFocus
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value.slice(0, 16))}
            onKeyDown={(e) => e.key === "Enter" && enter()}
            placeholder="LEWIS"
            className="w-64 text-center uppercase tracking-[0.2em] rounded-lg px-4 py-3 outline-none transition-colors"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${touched && !valid ? "var(--wine-500)" : "rgba(217,184,118,0.4)"}`,
              color: "var(--cream)",
              fontFamily: "var(--font-display)",
            }}
          />
          {touched && !valid && (
            <span className="text-[10px]" style={{ color: "var(--wine-500)" }}>
              2 à 16 caractères.
            </span>
          )}
        </div>

        <motion.button
          onClick={enter}
          whileHover={{ y: -2 }}
          whileTap={{ y: 1, scale: 0.98 }}
          className="px-8 py-3 rounded-full font-bold tracking-[0.15em] text-[13px]"
          style={{
            fontFamily: "var(--font-display)",
            background: "linear-gradient(180deg, var(--gold-400), var(--gold-600))",
            color: "var(--ink)",
            boxShadow: "0 6px 0 rgba(0,0,0,0.35), 0 10px 20px rgba(0,0,0,0.5)",
          }}
        >
          ENTRER DANS LE CASINO
        </motion.button>
      </motion.div>
    </div>
  );
}
