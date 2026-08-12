import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/api/client";

/**
 * Load something from the API, with the states every screen needs: first load,
 * pull-to-refresh, an error you can retry, and a guard against setting state
 * after the screen has gone.
 *
 * Written once because eight screens would otherwise each grow their own
 * slightly different version of it.
 */
export function useApi<T>(fetcher: () => Promise<T> | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const run = useCallback(async () => {
    const promise = fetcher();
    // Null means "not ready" — usually no token yet.
    if (!promise) return;
    try {
      setData(await promise);
      setError("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t load that. Please try again.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    let live = true;
    setLoading(true);
    void run().finally(() => {
      if (live) setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [run]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await run();
    setRefreshing(false);
  }, [run]);

  return { data, error, loading, refreshing, refresh };
}
