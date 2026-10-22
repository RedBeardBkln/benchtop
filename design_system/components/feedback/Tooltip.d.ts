import * as React from "react";
export interface TooltipProps {
  label: string;
  /** Keep visible (for specimens) */
  forceShow?: boolean;
  children?: React.ReactNode;
}
export declare function Tooltip(props: TooltipProps): JSX.Element;