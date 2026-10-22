import * as React from "react";
export interface TabsProps {
  items: { id: string; label: string }[];
  value: string;
  onChange?: (id: string) => void;
}
export declare function Tabs(props: TabsProps): JSX.Element;