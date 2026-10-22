import * as React from "react";
export interface BadgeProps {
  tone?: "neutral" | "lcd" | "ink" | "warm" | "ok" | "warn" | "danger";
  /** Leading status dot */
  dot?: boolean;
  children?: React.ReactNode;
}
export declare function Badge(props: BadgeProps): JSX.Element;