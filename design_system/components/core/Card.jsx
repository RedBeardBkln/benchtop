import React from "react";
export function Card({ tone = "paper", title, action, padding = 20, children, style }) {
  return <div className={"bt-card" + (tone !== "paper" ? " bt-card--" + tone : "")} style={style}>
    {title && <div className="bt-card__h"><span>{title}</span>{action}</div>}
    <div style={{ padding }}>{children}</div>
  </div>;
}