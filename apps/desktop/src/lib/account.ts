import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { AuthStatus, LibraryState } from "../../electron/preload";
import { bridge } from "./bridge";

export function useAuth() {
  const qc = useQueryClient();
  useEffect(() => bridge.auth.onChange((s) => qc.setQueryData(["auth"], s)), [qc]);
  return useQuery<AuthStatus>({ queryKey: ["auth"], queryFn: () => bridge.auth.status(), staleTime: Infinity });
}

export function useLibrary() {
  const qc = useQueryClient();
  useEffect(() => bridge.library.onChange((s) => qc.setQueryData(["library"], s)), [qc]);
  return useQuery<LibraryState>({ queryKey: ["library"], queryFn: () => bridge.library.get(), staleTime: Infinity });
}

export function useLibraryItem(id: string | undefined) {
  const { data } = useLibrary();
  return data?.items.find((i) => i.productId === id);
}
