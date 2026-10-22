import * as React from "react";
/** @startingPoint section="Core" subtitle="Primary, secondary and ghost buttons" viewport="700x200" */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = ink w/ lit-lcd text; secondary = lcd fill; ghost = quiet */
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  /** Lucide icon name shown before the label */
  icon?: string;
  /** Square icon-only button (pass icon, omit children) */
  iconOnly?: boolean;
}
export declare function Button(props: ButtonProps): JSX.Element;