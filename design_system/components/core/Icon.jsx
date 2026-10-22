import React from "react";
const cache = {};
export function Icon({ name, size = 20, color = "currentColor", style }) {
  const [svg, setSvg] = React.useState(cache[name] || "");
  React.useEffect(() => {
    if (cache[name]) { setSvg(cache[name]); return; }
    let ok = true;
    fetch("https://unpkg.com/lucide-static@0.468.0/icons/" + name + ".svg").then(r => r.text()).then(t => { cache[name] = t.replace(/width="24"/, 'width="100%"').replace(/height="24"/, 'height="100%"'); if (ok) setSvg(cache[name]); }).catch(() => {});
    return () => { ok = false; };
  }, [name]);
  return <span aria-hidden="true" style={{ display: "inline-flex", width: size, height: size, flex: "none", color, ...style }} dangerouslySetInnerHTML={{ __html: svg }} />;
}