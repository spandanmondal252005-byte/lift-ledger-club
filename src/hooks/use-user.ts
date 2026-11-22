import { useRouteContext } from "@tanstack/react-router";

/** The signed-in user, available anywhere under the protected app layout. */
export function useUser() {
  return useRouteContext({ from: "/_authenticated" }).user;
}
