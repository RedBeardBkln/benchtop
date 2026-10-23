import React from "react";
export function SegmentDisplay({ value = "0", height = 48, color = "var(--ink-900)", ghost = true }) {
  const fs = height * 1.7;
  return <span role="img" aria-label={String(value)} style={{ display: "inline-flex", fontFamily: "var(--font-segment)", fontWeight: 700, fontSize: fs, lineHeight: height * 1.1 + "px", height: height * 1.1, letterSpacing: "0.04em", color }}>
    {String(value).split("").map((ch, i) => <span key={i} style={{ display: "inline-grid" }}>
      {ghost && ch !== "." && ch !== " " && <span aria-hidden="true" style={{ gridArea: "1/1", opacity: 0.08 }}>8</span>}
      <span style={{ gridArea: "1/1" }}>{ch}</span>
    </span>)}
  </span>;
}