import * as React from "react";
/** @startingPoint section="Core" subtitle="Surface container, incl. lit LCD panel" viewport="700x260" */
export interface CardProps {
  /** paper = default; lcd = glowing screen panel w/ ghost segments; ink = dark; flat = no shadow */
  tone?: "paper" | "lcd" | "ink" | "flat";
  title?: string;
  /** Node right-aligned in header */
  action?: React.ReactNode;
  padding?: number | string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Card(props: CardProps): JSX.Element;