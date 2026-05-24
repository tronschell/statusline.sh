import type { Element } from "../../../../shared/types";
import { type FieldsProps } from "./common";

type PctElement = Extract<
  Element,
  { type: "contextPct" | "rateLimit5hPct" | "rateLimit7dPct" }
>;

export default function ContextPctFields(_: FieldsProps<PctElement>) {
  return null;
}
