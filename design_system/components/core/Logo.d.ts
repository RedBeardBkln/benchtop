import * as React from "react";
export interface LogoProps {
  /** mark = the seven-segment b; wordmark = b + "enchtop" (the b is the mark itself) */
  variant?: "mark" | "wordmark";
  height?: number;
  /** Any CSS colour; use ink on lcd/paper, lcd on ink */
  color?: string;
  style?: React.CSSProperties;
}
export declare function Logo(props: LogoProps): JSX.Element;