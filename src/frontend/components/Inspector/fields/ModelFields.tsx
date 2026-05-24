import type { Element } from "@statusline/shared/types";
import { type FieldsProps } from "./common";

type ModelElement = Extract<Element, { type: "model" }>;

export default function ModelFields(_: FieldsProps<ModelElement>) {
  return null;
}
