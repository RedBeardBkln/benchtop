import React from "react";
export function Tooltip({ label, forceShow = false, children }) {
  return <span className={"bt-tip" + (forceShow ? " bt-tip--show" : "")}>{children}<span className="bt-tip__b" role="tooltip">{label}</span></span>;
}