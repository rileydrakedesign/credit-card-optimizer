"use client";

import { useEffect, useState, useRef } from "react";
import { formatCurrency, formatNumber } from "@/lib/utils/helpers";

interface Props {
  value: number;
  format?: "currency" | "number";
  duration?: number;
}

export default function AnimatedNumber({ value, format = "number", duration = 800 }: Props) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    const startValue = 0;
    startRef.current = performance.now();

    function animate(now: number) {
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(startValue + (value - startValue) * eased);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  const formatted = format === "currency" ? formatCurrency(display) : formatNumber(display);
  return <span>{formatted}</span>;
}
