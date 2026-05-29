import { useEffect, useMemo, useRef, useState } from "react";
import "./index.css";
import { Analytics } from "@vercel/analytics/react";
import { ElementPalette } from "./frontend/components/Palette/ElementPalette";
import { StatuslineCanvas } from "./frontend/components/Canvas/StatuslineCanvas";
import { DndProvider } from "./frontend/hooks/useDnd";
import { LivePreview } from "./frontend/components/Preview/LivePreview";
import { BuilderPage, parseBuilderQuery } from "./frontend/components/Builder/BuilderPage";
import BuilderSetupModal from "./frontend/components/Builder/BuilderSetupModal";
import SettingsModal from "./frontend/components/Builder/SettingsModal";
import { CollapsibleInspector } from "./frontend/components/Builder/CollapsibleInspector";
import { TEMPLATES } from "@statusline/shared/templates";
import TopBar from "./frontend/components/Layout/TopBar";
import { NavBar } from "./frontend/components/Layout/NavBar";
import { Footer } from "./frontend/components/Layout/Footer";
import { AppShell } from "./frontend/components/Layout/AppShell";
import { Seo } from "./frontend/components/Seo";
import { PrivacyPage } from "./frontend/components/Legal/PrivacyPage";
import { TermsPage } from "./frontend/components/Legal/TermsPage";
import InstallDrawer from "./frontend/components/Install/InstallDrawer";
import PublishDialog from "./frontend/components/Community/PublishDialog";
import { CommunityPage } from "./frontend/components/Community/CommunityPage";
import { CommunityDetailPage } from "./frontend/components/Community/CommunityDetailPage";
import { ClaudeCodeStatuslineGuidePage } from "./frontend/components/Guides/ClaudeCodeStatuslineGuidePage";
import { ProgrammaticRoute } from "./frontend/components/Programmatic/ProgrammaticRoute";
import { useShareState } from "./frontend/hooks/useShareState";
import { useUndoRedo } from "./frontend/hooks/useUndoRedo";
import { useDesignStore } from "./frontend/store/designStore";
import { useUiStore } from "./frontend/store/uiStore";
import { Route, Router, useParams } from "./frontend/router";
// T12 owns LandingPage; T9 ships a placeholder so the build is green from day
// one. The import is static — if T12 has shipped the real file, this resolves
// to the full marketing page; otherwise the placeholder renders.
import { LandingPage } from "./frontend/components/Landing/LandingPage";

export function App() {
  return (
    <Router>
      <Seo />

      {/* Global chrome: NavBar is sticky and shows on every route. */}
      <NavBar />

      {/* Routes. Each <Route> renders only when its path matches. */}
      <Route path="/">
        <LandingPage />
      </Route>

      <Route path="/builder">
        <BuilderRoute />
      </Route>

      <Route path="/community">
        <CommunityPage />
      </Route>

      <Route path="/community/:slug">
        <CommunityDetailRoute />
      </Route>

      <Route path="/how-to-make-a-claude-code-statusline">
        <ClaudeCodeStatuslineGuidePage />
      </Route>

      <Route path="/claude-code-statusline-:topic">
        <ProgrammaticRoute />
      </Route>

      <Route path="/privacy">
        <PrivacyPage />
      </Route>

      <Route path="/terms">
        <TermsPage />
      </Route>

      <Footer />
      <Analytics />
    </Router>
  );
}

function CommunityDetailRoute() {
  const { slug } = useParams<{ slug: string }>();
  return <CommunityDetailPage slug={slug} />;
}

/**
 * Full builder experience: TopBar + AppShell (palette / canvas+preview /
 * inspector) plus the InstallDrawer and PublishDialog. Mounting these dialogs
 * here means they only exist while the user is actually on the builder route.
 */
function BuilderRoute() {
  useUndoRedo();
  const designName = useDesignStore((s) => s.design.name);
  const { slug, setSlug } = useShareState();

  const [installOpen, setInstallOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(true);
  const selectedId = useDesignStore((s) => s.selectedId);

  // Which template (if any) seeded this builder session — drives the setup
  // prompt's "this template separates items with…" mass-change section.
  const { templateId, templateName } = useMemo(() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    const id = parseBuilderQuery(search).templateId ?? null;
    const name = id ? (TEMPLATES.find((t) => t.id === id)?.name ?? null) : null;
    return { templateId: id, templateName: name };
  }, []);

  // One-time setup prompt: always re-show on template load (so spacing/
  // mass-change can be tuned for that template, once per template per session),
  // otherwise show once until the user has gone through it.
  const setupShownRef = useRef(false);
  useEffect(() => {
    if (setupShownRef.current) return;
    setupShownRef.current = true;
    if (templateId) {
      const key = `statusline-setup-shown:${templateId}`;
      let shown = false;
      try {
        shown = sessionStorage.getItem(key) === "1";
      } catch {
        shown = false;
      }
      if (!shown) {
        setSetupOpen(true);
        try {
          sessionStorage.setItem(key, "1");
        } catch {
          // ignore disabled/quota'd storage
        }
      }
      return;
    }
    if (!useUiStore.getState().builderSetupSeen) {
      setSetupOpen(true);
    }
  }, [templateId]);

  // Auto-open the inspector whenever the user picks a chip — clicking an
  // element clearly signals intent to edit it, so the closed-by-default rail
  // should expand to surface the inspector content.
  useEffect(() => {
    if (selectedId) setInspectorCollapsed(false);
  }, [selectedId]);

  return (
    <BuilderPage>
      <DndProvider>
        <AppShell
          topBar={
            <TopBar
              slug={slug}
              onOpenInstall={() => setInstallOpen(true)}
              onOpenPublish={() => setPublishOpen(true)}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          }
          palette={<ElementPalette />}
          canvas={
            <>
              <StatuslineCanvas />
              <LivePreview />
            </>
          }
          inspector={
            <CollapsibleInspector
              collapsed={inspectorCollapsed}
              onToggle={() => setInspectorCollapsed((v) => !v)}
            />
          }
          inspectorCollapsed={inspectorCollapsed}
        />
      </DndProvider>

      <BuilderSetupModal
        isOpen={setupOpen}
        onClose={() => setSetupOpen(false)}
        templateId={templateId}
        templateName={templateName}
      />

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        templateId={templateId}
        templateName={templateName}
      />

      <InstallDrawer
        designId={null}
        isOpen={installOpen}
        onClose={() => setInstallOpen(false)}
      />

      <PublishDialog
        designName={designName}
        isOpen={publishOpen}
        onClose={() => setPublishOpen(false)}
        onPublished={(s) => setSlug(s)}
      />
    </BuilderPage>
  );
}

export default App;
