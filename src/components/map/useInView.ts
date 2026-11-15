"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Tracks whether an element is on (or near) screen. Used to pause decorative
 * animation off-screen and to defer heavy work (the map) until it is needed.
 * `once` keeps the value true after the first intersection.
 */
export function useInView<T extends Element>({
  rootMargin = "0px",
  once = false,
}: { rootMargin?: string; once?: boolean } = {}) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (entry.isIntersecting && once) io.disconnect();
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin, once]);
  return [ref, inView] as const;
}
