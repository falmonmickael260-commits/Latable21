"use client";

import { useCallback, useEffect, useState } from "react";

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Tracks an element's box relative to its offsetParent, live — so overlays
 * can be anchored to fractional points within an `<img>` whose rendered
 * size/position change with the viewport. Uses a callback ref (not
 * useRef+useEffect) because the element may not exist on the component's
 * first render (e.g. gated behind a loading state) — a plain ref would
 * attach its observer to `null` once and never notice the element mounting
 * later. Measures via getBoundingClientRect (not offsetLeft/offsetTop),
 * because offset* ignores CSS transforms (e.g. `-translate-x-1/2` used to
 * center the image) while getBoundingClientRect reflects the true visual
 * position.
 */
export function useImageBox<T extends HTMLElement>() {
  const [node, setNode] = useState<T | null>(null);
  const [box, setBox] = useState<Box>({ left: 0, top: 0, width: 0, height: 0 });

  const ref = useCallback((el: T | null) => setNode(el), []);

  useEffect(() => {
    if (!node) return;
    const parent = (node.offsetParent as HTMLElement) ?? node.parentElement;

    const measure = () => {
      const nodeRect = node.getBoundingClientRect();
      const parentRect = (parent ?? node).getBoundingClientRect();
      setBox({
        left: nodeRect.left - parentRect.left,
        top: nodeRect.top - parentRect.top,
        width: nodeRect.width,
        height: nodeRect.height,
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [node]);

  return { ref, box };
}
