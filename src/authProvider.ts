import type { AuthProvider, UserIdentity } from "ra-core";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SetPasswordParams = { password: string };
export interface SupabaseAuthProvider extends AuthProvider {
  setPassword: (params: SetPasswordParams) => Promise<void>;
}

export type LoginCredentials = { username: string; password: string };

class CheckAuthError extends Error {
  redirectTo: string;

  constructor(message: string, redirectTo: string) {
    super(message);
    this.redirectTo = redirectTo;
  }
}

export type GetIdentity = (userId: string) => UserIdentity;

export const supabaseAuthProvider = (
  client: SupabaseClient,
  getIdentity: GetIdentity = (userId: string) => ({ id: userId })
): SupabaseAuthProvider => ({
  async login({ username: email, password }: LoginCredentials) {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(`(${error.status}): ${error.message}`);
    }
    return undefined;
  },
  async logout() {
    await client.auth.signOut();
  },
  async checkAuth() {
    if ((await client.auth.getSession()) === null) {
      throw new Error();
    }

    return Promise.resolve();
  },
  async checkError() {
    return Promise.resolve();
  },
  async getPermissions() {
    return Promise.resolve();
  },
  async setPassword({ password }: SetPasswordParams) {
    const { error } = await client.auth.updateUser({ password });
    if (error) {
      throw new CheckAuthError(`(${error.status}) ${error.message}`, "/login");
    }
  },
  async getIdentity() {
    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser();
    if (!user || userError) {
      throw new Error();
    }

    return getIdentity(user.id);
  },
});
