import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Design } from "@statusline/shared/types";
import { accountApi, ApiError, type CloudDesign } from "../lib/accountApi";

/** The library (or team) design the builder is currently bound to, if any. */
export interface CloudCurrent {
  id: string;
  version: number;
  name: string;
  teamId: string | null;
  linkEnabled: boolean;
}

interface CloudState {
  current: CloudCurrent | null;
  /** JSON of the design as last saved, to tell whether there are unsaved edits. */
  snapshot: string | null;
  saving: boolean;
  error: { code: string; message: string } | null;
  bind(cd: CloudDesign | null): void;
  /** Create the library entry, or save a new version of the bound one. */
  save(design: Design): Promise<CloudDesign | null>;
}

export const useCloudStore = create<CloudState>()(
  persist(
    (set, get) => ({
      current: null,
      snapshot: null,
      saving: false,
      error: null,
      bind(cd) {
        set({
          current: cd
            ? {
                id: cd.id,
                version: cd.version,
                name: cd.name,
                teamId: cd.team_id,
                linkEnabled: cd.link_enabled,
              }
            : null,
          snapshot: cd ? JSON.stringify(cd.design) : null,
          error: null,
        });
      },
      async save(design) {
        set({ saving: true, error: null });
        const name = design.name?.trim() || "Untitled";
        const cur = get().current;
        try {
          const cd = cur
            ? await accountApi.librarySave(cur.id, { name, design, expected_version: cur.version })
            : await accountApi.libraryCreate(name, design);
          get().bind(cd);
          set({ saving: false });
          return cd;
        } catch (e) {
          const err =
            e instanceof ApiError
              ? { code: e.code, message: e.message }
              : { code: "error", message: e instanceof Error ? e.message : String(e) };
          set({ saving: false, error: err });
          return null;
        }
      },
    }),
    {
      name: "statusline-cloud-v1",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ current: s.current, snapshot: s.snapshot }),
    },
  ),
);
