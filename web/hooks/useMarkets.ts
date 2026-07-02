"use client";

import { useEffect, useRef, useState } from "react";
import type { MarketsResponse } from "@/lib/types";

const POLL_MS = 20_000;

/** Polls /api/markets; pauses while the tab is hidden. */
export function useMarkets(): {
  data: MarketsResponse | null;
  error: string | null;
  loading: boolean;
} {
  const [data, setData] = useState<MarketsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/markets");
        const body = (await res.json()) as MarketsResponse | { error: string };
        if (cancelled) return;
        if ("error" in body) setError(body.error);
        else {
          setData(body);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    function start() {
      void load();
      timer.current = setInterval(() => void load(), POLL_MS);
    }
    function stop() {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    }
    function onVisibility() {
      if (document.hidden) stop();
      else if (!timer.current) start();
    }

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return { data, error, loading };
}
