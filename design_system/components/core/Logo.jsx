import React from "react";
export function Logo({ variant = "mark", height = 48, color = "var(--ink-900)", style }) {
  return <span aria-label="benchtop" style={{ display: "inline-block", fontFamily: "var(--font-segment)", fontWeight: 700, fontSize: height * 1.7, lineHeight: height * 1.1 + "px", height: height * 1.1, letterSpacing: "0.04em", color, whiteSpace: "nowrap", ...style }}>{variant === "mark" ? "B" : "BENCHTOP"}</span>;
}