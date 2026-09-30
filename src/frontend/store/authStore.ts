import { create } from "zustand";
import { accountApi, ApiError, type Me } from "../lib/accountApi";
import { ACCOUNTS_ENABLED } from "../lib/config";
import { getToken, setToken } from "../lib/session";
import { useCloudStore } from "./cloudStore";

interface AuthState {
  /** null = signed out (or not yet known — see `ready`). */
  me: Me | null;
  /** True once the initial /me check has finished, so the UI never flashes signed-out. */
  ready: boolean;
  init(): Promise<void>;
  /** Store a fresh session token (sign-in, sign-up, OAuth callback, reset). */
  signIn(token: string): Promise<void>;
  refresh(): Promise<void>;
  signOut(): Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  me: null,
  ready: !ACCOUNTS_ENABLED || !getToken(),
  async init() {
    if (!ACCOUNTS_ENABLED || !getToken()) {
      set({ ready: true });
      return;
    }
    await get().refresh();
  },
  async signIn(token) {
    setToken(token);
    await get().refresh();
  },
  async refresh() {
    if (!getToken()) {
      set({ me: null, ready: true });
      return;
    }
    try {
      set({ me: await accountApi.me(), ready: true });
    } catch (e) {
      // Only an explicit 401 means the token is dead; a network blip must not sign people out.
      if (e instanceof ApiError && e.status === 401) {
        setToken(null);
        set({ me: null, ready: true });
      } else {
        set({ ready: true });
      }
    }
  },
  async signOut() {
    try {
      await accountApi.logout();
    } catch {
      // token may already be invalid; clear locally regardless
    }
    setToken(null);
    useCloudStore.getState().bind(null); // don't leave a signed-out tab bound to someone's library design
    set({ me: null });
  },
}));
