import type { Element } from "@statusline/shared/types";
import { type FieldsProps } from "./common";

type LinesAddedElement = Extract<Element, { type: "linesAdded" }>;

export default function LinesAddedFields(_: FieldsProps<LinesAddedElement>) {
  return null;
}
