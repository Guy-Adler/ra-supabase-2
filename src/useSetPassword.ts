import { useAuthProvider, useNotify, useRedirect } from "ra-core";
import type { onError, OnSuccess } from "ra-core";
import type { SetPasswordParams, SupabaseAuthProvider } from "./authProvider";

export const useSetPassword = (options: UseSetPasswordOptions) => {
  const notify = useNotify();
  const redirect = useRedirect();
  const authProvider = useAuthProvider() as SupabaseAuthProvider;

  const { onSuccess, onError } = options || {
    onSuccess: () => redirect("/"),
    onError: (error) =>
      notify(error.message, {
        type: "error",
      }),
  };

  return (params: SetPasswordParams) => {
    authProvider
      .setPassword(params)
      .then(() => {
        if (onSuccess) {
          onSuccess();
        }
      })
      .catch((error) => {
        if (onError) {
          onError(error);
        }
      });
  };
};

export type UseSetPasswordOptions = {
  onSuccess?: OnSuccess;
  onError?: onError;
};
