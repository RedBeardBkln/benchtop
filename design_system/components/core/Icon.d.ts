import * as React from "react";
export interface IconProps {
  /** Lucide icon name, e.g. "flask-conical", "scale", "sparkles" */
  name: string;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}
export declare function Icon(props: IconProps): JSX.Element;