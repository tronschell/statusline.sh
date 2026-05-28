import { useEffect } from "react";
import { useParams } from "../../router";
import { findProgrammaticPage } from "./programmatic";
import { ProgrammaticPage } from "./ProgrammaticPage";

/**
 * Route wrapper for /claude-code-statusline-:topic.
 *
 * Resolves the topic param against the programmatic page registry and
 * renders the shared page component. Unknown topics redirect to the
 * landing page (browsers reaching this route hit a 404-equivalent
 * client redirect rather than a blank screen) — the path won't be
 * linked from anywhere internally, but it could be hit via a typo'd
 * external link.
 */
export function ProgrammaticRoute() {
  const { topic } = useParams<{ topic: string }>();
  const config = findProgrammaticPage(topic ?? "");

  useEffect(() => {
    if (!config && typeof window !== "undefined") {
      window.location.replace("/");
    }
  }, [config]);

  if (!config) return null;
  return <ProgrammaticPage config={config} />;
}

export default ProgrammaticRoute;
