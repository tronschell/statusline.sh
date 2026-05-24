import type { Element } from "@statusline/shared/types";
import { type FieldsProps } from "./common";

type GitBranchElement = Extract<Element, { type: "gitBranch" }>;

export default function GitBranchFields(_: FieldsProps<GitBranchElement>) {
  return null;
}
