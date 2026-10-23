import * as React from "react";
export interface LogoProps {
  /** mark = "B"; wordmark = "BENCHTOP" — both set in DS-Digital capitals */
  variant?: "mark" | "wordmark";
  /** Cap height in px */
  height?: number;
  color?: string;
  style?: React.CSSProperties;
}
export declare function Logo(props: LogoProps): JSX.Element;