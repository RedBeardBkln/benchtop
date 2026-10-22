import React from "react";
export function Switch({ label, ...rest }) {
  return <label className="bt-sw"><input type="checkbox" role="switch" {...rest} /><span className="bt-sw__t" />{label}</label>;
}