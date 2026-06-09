"use client";

import { useRouterState } from "@tanstack/react-router";

import { loginSearchFromLocation } from "./auth-redirect";

/** Current route as `/login` search params for post-auth return navigation. */
export function useLoginSearch(): { redirect?: string } {
  const { pathname, search, hash } = useRouterState({
    select: (state) => state.location,
  });
  const origin =
    globalThis.window === undefined
      ? "http://localhost"
      : globalThis.location.origin;
  return loginSearchFromLocation(pathname, search, hash, origin);
}
