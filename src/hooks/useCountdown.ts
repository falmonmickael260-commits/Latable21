"use client";

import { useEffect, useState } from "react";

/** Milliseconds remaining until `deadline`, ticking once per second. */
export function useCountdown(deadline: number | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (deadline === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadline]);

  if (deadline === null) return 0;
  return Math.max(0, deadline - now);
}
