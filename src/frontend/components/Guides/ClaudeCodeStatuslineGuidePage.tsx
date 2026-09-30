import {
  COMMAND_GUIDE_PATH,
  STATUSLINE_GUIDE_PATH,
  guideByPath,
  type GuidePageData,
} from "./guideContent";
import { GuidePage } from "./GuidePage";

function pageAt(path: string): GuidePageData {
  const page = guideByPath(path);
  if (!page) throw new Error(`No guide content registered for ${path}`);
  return page;
}

const PILLAR = pageAt(STATUSLINE_GUIDE_PATH);
const COMMAND = pageAt(COMMAND_GUIDE_PATH);

/** /how-to-make-a-claude-code-statusline */
export function ClaudeCodeStatuslineGuidePage() {
  return <GuidePage page={PILLAR} />;
}

/** /claude-code-statusline-command */
export function ClaudeCodeStatuslineCommandPage() {
  return <GuidePage page={COMMAND} />;
}

export default ClaudeCodeStatuslineGuidePage;
