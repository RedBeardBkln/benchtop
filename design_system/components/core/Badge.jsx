import React from "react";
export function Badge({ tone = "neutral", dot = false, children }) {
  return <span className={"bt-badge bt-badge--" + tone}>{dot && <i className="bt-badge__d" />}{children}</span>;
}