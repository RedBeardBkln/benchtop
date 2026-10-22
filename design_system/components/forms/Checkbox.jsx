import React from "react";
export function Checkbox({ label, disabled, ...rest }) {
  return <label className={"bt-chk" + (disabled ? " bt-chk--off" : "")}><input type="checkbox" disabled={disabled} {...rest} /><span className="bt-chk__b" />{label}</label>;
}