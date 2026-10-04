import { afterEach, describe, expect, test } from "bun:test";
import { validateDesign } from "@statusline/shared/schema";
import type { Design } from "@statusline/shared/types";
import { accountApi, type CloudDesign } from "../src/frontend/lib/accountApi";
import { useCloudStore } from "../src/frontend/store/cloudStore";

const originalCreate = accountApi.libraryCreate;
const originalSave = accountApi.librarySave;
const submitted: Design = {
  version: 1, name: "Save regression",
  elements: [{ id: "model-one", type: "model", style: {}, prefix: "" }],
};
const returned = (design: Design, version = 1): CloudDesign => ({
  id: "fixture12345", team_id: null, name: design.name!,
  design: validateDesign(design), version, link_enabled: true,
  created_at: 1, updated_at: 1,
});

afterEach(() => {
  accountApi.libraryCreate = originalCreate;
  accountApi.librarySave = originalSave;
  useCloudStore.setState({ current: null, snapshot: null, saving: false, error: null });
});

describe("cloud save state", () => {
  test("a normalized API response does not leave an unchanged editor dirty", async () => {
    const response = returned(submitted);
    expect(JSON.stringify(response.design)).not.toBe(JSON.stringify(submitted));
    accountApi.libraryCreate = async () => response;
    await useCloudStore.getState().save(submitted);
    const saved = useCloudStore.getState();
    expect(saved.current?.version).toBe(1);
    expect(saved.snapshot === JSON.stringify(submitted)).toBe(true);
    expect(saved.saving).toBe(false);
  });

  test("edits made during an update remain dirty after the response arrives", async () => {
    useCloudStore.getState().bind(returned(submitted));
    const savingDesign = { ...submitted, name: "Saving version" };
    const laterDesign = { ...submitted, name: "Newer unsaved edit" };
    let finish!: (response: CloudDesign) => void;
    let receivedVersion: number | undefined;
    accountApi.librarySave = async (_id, body) => {
      receivedVersion = body.expected_version;
      return new Promise<CloudDesign>((resolve) => { finish = resolve; });
    };
    const pending = useCloudStore.getState().save(savingDesign);
    expect(useCloudStore.getState().saving).toBe(true);
    finish(returned(savingDesign, 2));
    await pending;
    const saved = useCloudStore.getState();
    expect(receivedVersion).toBe(1);
    expect(saved.current?.version).toBe(2);
    expect(saved.snapshot).toBe(JSON.stringify(savingDesign));
    expect(saved.snapshot === JSON.stringify(laterDesign)).toBe(false);
  });

  test("a failed update keeps the last successful version and pending edits", async () => {
    useCloudStore.getState().bind(returned(submitted));
    const before = useCloudStore.getState().snapshot;
    accountApi.librarySave = async () => { throw new Error("Save failed"); };
    const edit = { ...submitted, name: "Unsaved edit" };
    expect(await useCloudStore.getState().save(edit)).toBeNull();
    const saved = useCloudStore.getState();
    expect(saved.current?.version).toBe(1);
    expect(saved.snapshot).toBe(before);
    expect(saved.snapshot === JSON.stringify(edit)).toBe(false);
    expect(saved.error?.message).toBe("Save failed");
    expect(saved.saving).toBe(false);
  });
});
