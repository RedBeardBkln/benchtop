import React from "react";
const P = ["0,0 18,18 18,80 0,80", "0,90 18,90 18,152 0,170", "21,94 39,76 61,76 79,94", "82,90 100,90 100,170 82,152", "21,170 39,152 61,152 79,170"];
export function Logo({ variant = "mark", height = 48, color = "var(--ink-900)", style }) {
  const svg = (h) => <svg viewBox="0 0 100 170" aria-label="benchtop" style={{ display: "block", height: h }}>{P.map((p, i) => <polygon key={i} points={p} fill={color} />)}</svg>;
  if (variant === "mark") return <span style={{ display: "inline-flex", ...style }}>{svg(height)}</span>;
  const f = height;
  return <span style={{ display: "inline-flex", alignItems: "baseline", gap: f * 0.06, color, ...style }}>
    {svg(f * 0.82)}
    <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: f, letterSpacing: "-0.04em", lineHeight: 1 }}>enchtop</span>
  </span>;
}