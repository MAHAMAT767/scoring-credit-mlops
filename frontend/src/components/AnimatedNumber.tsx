import { useState, useEffect, useRef } from "react";

export default function AnimatedNumber({ value, decimals = 0, suffix = "" }:
  { value: number; decimals?: number; suffix?: string }) {
  const [displayed, setDisplayed] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    const from = prev.current;
    const dur = 800, start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplayed(from + (value - from) * e);
      if (p < 1) requestAnimationFrame(tick);
      else prev.current = value;
    };
    requestAnimationFrame(tick);
  }, [value]);

  return <>{displayed.toFixed(decimals)}{suffix}</>;
}
