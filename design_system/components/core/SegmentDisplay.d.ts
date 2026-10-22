import * as React from "react";
export interface SegmentDisplayProps {
  /** Characters 0-9, "-", "b", space and "." */
  value: string;
  height?: number;
  color?: string;
  /** Show unlit segments faintly */
  ghost?: boolean;
}
export declare function SegmentDisplay(props: SegmentDisplayProps): JSX.Element;