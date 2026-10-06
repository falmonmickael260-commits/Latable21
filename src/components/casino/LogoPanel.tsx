"use client";

/**
 * The crest behind the dealer — crown, "LA TABLE 21", gold-on-marble — a
 * crisp foreground graphic so it reads clearly even though the photo
 * backdrop behind it is softened out of focus.
 */
export function LogoPanel() {
  return (
    <div className="relative flex flex-col items-center select-none pointer-events-none">
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: 220,
          height: 220,
          background: "radial-gradient(circle, rgba(217,184,118,0.28), transparent 70%)",
          filter: "blur(4px)",
        }}
      />
      <div
        className="relative flex flex-col items-center px-5 pt-3 pb-4 rounded-t-[56px] rounded-b-lg"
        style={{
          background:
            "radial-gradient(ellipse 120% 80% at 50% 0%, rgba(58,42,22,0.9), rgba(8,6,4,0.95) 60%), repeating-linear-gradient(115deg, rgba(255,255,255,0.025) 0 2px, transparent 2px 9px)",
          border: "1.5px solid var(--gold-500)",
          boxShadow: "0 0 24px rgba(217,184,118,0.35), inset 0 0 18px rgba(0,0,0,0.6)",
        }}
      >
        <svg width="30" height="22" viewBox="0 0 24 24" fill="none" className="mb-0.5">
          <path
            d="M3 8l3.5 3L12 5l5.5 6L21 8l-1.6 9H4.6L3 8Z"
            fill="var(--gold-400)"
            stroke="var(--gold-200)"
            strokeWidth="0.5"
          />
        </svg>
        <div className="flex flex-col items-center leading-[0.9]" style={{ fontFamily: "var(--font-display)" }}>
          <span className="text-[11px] tracking-[0.3em]" style={{ color: "var(--gold-300, #e8cf9a)" }}>
            LA
          </span>
          <span className="text-[20px] font-bold tracking-wide text-gold-gradient">TABLE</span>
          <span className="text-[22px] font-black tracking-wide text-gold-gradient">21</span>
        </div>
        <div className="flex gap-1.5 mt-1 text-[9px]" style={{ opacity: 0.8 }}>
          <span style={{ color: "#e8cf9a" }}>♠</span>
          <span style={{ color: "#a9414c" }}>♥</span>
          <span style={{ color: "#e8cf9a" }}>♣</span>
          <span style={{ color: "#a9414c" }}>♦</span>
        </div>
      </div>
    </div>
  );
}
