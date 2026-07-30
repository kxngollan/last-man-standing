"use client";

import { useCallback, useEffect, useState } from "react";
import type { PortalState } from "@/lib/game/portalTypes";

export interface UsePortalState {
  state: PortalState | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/** Fetch the signed-in user's portal state from /api/state. */
export function usePortalState(): UsePortalState {
  const [state, setState] = useState<PortalState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setState((await res.json()) as PortalState);
      setError(null);
    } catch {
      setError("We couldn’t load the game. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { state, loading, error, refetch };
}
