import * as React from "react";
/** @startingPoint section="Forms" subtitle="Labelled text input with unit + error" viewport="700x260" */
export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "className"> {
  label?: string;
  hint?: string;
  /** Error message; turns border red */
  error?: string;
  /** Monospace value — use for quantities, SKUs */
  mono?: boolean;
  /** Trailing unit, e.g. "g", "%", "°C" */
  unit?: string;
}
export declare function Input(props: InputProps): JSX.Element;