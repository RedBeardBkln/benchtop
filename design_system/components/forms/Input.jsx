import React from "react";
export function Input({ label, hint, error, mono = false, unit, className = "", ...rest }) {
  return <label className={"bt-in" + (mono ? " bt-in--mono" : "") + (error ? " bt-in--err" : "")}>
    {label && <span className="bt-in__l">{label}</span>}
    <span className="bt-in__f"><input {...rest} />{unit && <span className="bt-in__u">{unit}</span>}</span>
    {(error || hint) && <span className="bt-in__h">{error || hint}</span>}
  </label>;
}