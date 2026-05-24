import type { Element } from "../../../../shared/types";
import { type FieldsProps } from "./common";

type ContextPctElement = Extract<Element, { type: "contextPct" }>;

export default function ContextPctFields(_: FieldsProps<ContextPctElement>) {
  return null;
}
