import React from "react";
import { Icon } from "./Icon.jsx";
export function Button({ variant = "primary", size = "md", icon, iconOnly = false, children, className = "", ...rest }) {
  const cls = ["bt-btn", "bt-btn--" + variant, size !== "md" && "bt-btn--" + size, iconOnly && "bt-btn--icon", className].filter(Boolean).join(" ");
  return <button className={cls} {...rest}>{icon && <Icon name={icon} size={size === "lg" ? 22 : 18} />}{children}</button>;
}