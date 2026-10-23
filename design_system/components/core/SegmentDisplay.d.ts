import * as React from "react";
export interface SegmentDisplayProps {
  /** Text in the DS-Digital segment font: letters, digits, "-", "." */
  value: string;
  /** Cap height in px */
  height?: number;
  color?: string;
  /** Show unlit segments faintly (an "8" behind each character) */
  ghost?: boolean;
}
export declare function SegmentDisplay(props: SegmentDisplayProps): JSX.Element;