import React from "react";
export function Tabs({ items = [], value, onChange }) {
  return <div className="bt-tabs" role="tablist">{items.map(it => <button key={it.id} role="tab" aria-selected={it.id === value} className="bt-tab" onClick={() => onChange && onChange(it.id)}>{it.label}</button>)}</div>;
}