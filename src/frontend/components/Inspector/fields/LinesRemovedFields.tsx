import type { Element } from "@statusline/shared/types";
import { type FieldsProps } from "./common";

type LinesRemovedElement = Extract<Element, { type: "linesRemoved" }>;

export default function LinesRemovedFields(
  _: FieldsProps<LinesRemovedElement>,
) {
  return null;
}
