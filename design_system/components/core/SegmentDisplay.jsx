import React from "react";
const S = { a: "6,0 54,0 46,8 14,8", b: "60,6 60,46 52,42 52,14", c: "60,54 60,94 52,86 52,58", d: "6,100 54,100 46,92 14,92", e: "0,54 0,94 8,86 8,58", f: "0,6 0,46 8,42 8,14", g: "8,50 14,44 46,44 52,50 46,56 14,56" };
const M = { "0": "abcdef", "1": "bc", "2": "abdeg", "3": "abcdg", "4": "bcfg", "5": "acdfg", "6": "acdefg", "7": "abc", "8": "abcdefg", "9": "abcdfg", "-": "g", b: "cdefg", " ": "" };
export function SegmentDisplay({ value = "0", height = 48, color = "var(--ink-900)", ghost = true }) {
  return <span role="img" aria-label={value} style={{ display: "inline-flex", gap: height * 0.12, alignItems: "flex-end" }}>
    {String(value).split("").map((ch, i) => ch === "." ? <span key={i} style={{ width: height * 0.1, height: height * 0.1, background: color, marginLeft: -height * 0.04 }} /> :
      <svg key={i} viewBox="0 0 60 100" style={{ height, display: "block" }}>
        {Object.keys(S).map(k => { const on = (M[ch] || "").includes(k); return (on || ghost) && <polygon key={k} points={S[k]} fill={color} fillOpacity={on ? 1 : 0.08} />; })}
      </svg>)}
  </span>;
}