"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Uses a callback ref (not useRef+useEffect) because the element may not
 * exist on the component's first render (e.g. gated behind a loading
 * state) — a plain ref would attach its ResizeObserver to `null` once and
 * never notice the element mounting later.
 */
export function useElementSize<T extends HTMLElement>() {
  const [node, setNode] = useState<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const ref = useCallback((el: T | null) => setNode(el), []);

  useEffect(() => {
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return { ref, size };
}
