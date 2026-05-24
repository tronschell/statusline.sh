import { useCallback, useEffect, useState } from "react";
import "./index.css";
import { ElementPalette } from "./frontend/components/Palette/ElementPalette";
import { StatuslineCanvas } from "./frontend/components/Canvas/StatuslineCanvas";
import { DndProvider } from "./frontend/hooks/useDnd";
import { LivePreview } from "./frontend/components/Preview/LivePreview";
import { BuilderPage } from "./frontend/components/Builder/BuilderPage";
import { CollapsibleInspector } from "./frontend/components/Builder/CollapsibleInspector";
import TopBar from "./frontend/components/Layout/TopBar";
import { NavBar } from "./frontend/components/Layout/NavBar";
import { Footer } from "./frontend/components/Layout/Footer";
import { AppShell } from "./frontend/components/Layout/AppShell";
import { PrivacyPage } from "./frontend/components/Legal/PrivacyPage";
import { TermsPage } from "./frontend/components/Legal/TermsPage";
import InstallDrawer from "./frontend/components/Install/InstallDrawer";
import PublishDialog from "./frontend/components/Community/PublishDialog";
import { CommunityPage } from "./frontend/components/Community/CommunityPage";
import { CommunityDetailPage } from "./frontend/components/Community/CommunityDetailPage";
import { useShareState } from "./frontend/hooks/useShareState";
import { useUndoRedo } from "./frontend/hooks/useUndoRedo";
import { useDesignStore } from "./frontend/store/designStore";
import { api } from "./frontend/lib/api";
import { Route, Router, useParams } from "./frontend/router";
// T12 owns LandingPage; T9 ships a placeholder so the build is green from day
// one. The import is static — if T12 has shipped the real file, this resolves
// to the full marketing page; otherwise the placeholder renders.
import { LandingPage } from "./frontend/components/Landing/LandingPage";

export function App() {
  return (
    <Router>
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

      <Route path="/privacy">
        <PrivacyPage />
      </Route>

      <Route path="/terms">
        <TermsPage />
      </Route>

      <Footer />
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
  const { designId, slug, setDesignId, setSlug } = useShareState();

  const [installOpen, setInstallOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(true);
  const selectedId = useDesignStore((s) => s.selectedId);

  // Auto-open the inspector whenever the user picks a chip — clicking an
  // element clearly signals intent to edit it, so the closed-by-default rail
  // should expand to surface the inspector content.
  useEffect(() => {
    if (selectedId) setInspectorCollapsed(false);
  }, [selectedId]);

  const onSaveShare = useCallback(
    (id: string) => {
      // A fresh save lands a new row server-side, so any cached slug is stale.
      setDesignId(id);
      setSlug(null);
      setInstallOpen(true);
    },
    [setDesignId, setSlug],
  );

  // Used when the user opens Publish before saving — we save then re-open Publish.
  const onRequestSaveFromPublish = useCallback(async () => {
    try {
      const design = useDesignStore.getState().design;
      const { id } = await api.createDesign(design);
      setDesignId(id);
      setSlug(null);
      setPublishOpen(true);
    } catch (err) {
      console.error("[App] save-from-publish failed:", err);
    }
  }, [setDesignId, setSlug]);

  return (
    <BuilderPage>
      <DndProvider>
        <AppShell
          topBar={
            <TopBar
              designId={designId}
              slug={slug}
              onSaveShare={onSaveShare}
              onOpenPublish={() => setPublishOpen(true)}
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

      <InstallDrawer
        designId={designId}
        isOpen={installOpen}
        onClose={() => setInstallOpen(false)}
      />

      <PublishDialog
        designId={designId}
        designName={designName}
        isOpen={publishOpen}
        onClose={() => setPublishOpen(false)}
        onRequestSave={() => void onRequestSaveFromPublish()}
        onPublished={(s) => setSlug(s)}
      />
    </BuilderPage>
  );
}

export default App;
