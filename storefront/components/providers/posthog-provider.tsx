"use client";

import { useEffect, useRef } from "react";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { setPostHogClient } from "lib/analytics";
import { sanitizeEnvValue } from "lib/env";

type Props = {
  children: React.ReactNode;
  bootstrapDistinctId: string | null;
  bootstrapFlags?: Record<string, boolean | string>;
};

export function PostHogProvider({
  children,
  bootstrapDistinctId,
  bootstrapFlags,
}: Props) {
  const prevDistinctId = useRef<string | null>(null);
  const key = sanitizeEnvValue(process.env.NEXT_PUBLIC_POSTHOG_KEY);
  const apiHost = sanitizeEnvValue(process.env.NEXT_PUBLIC_POSTHOG_HOST);

  useEffect(() => {
    if (!key) return;

    posthog.init(key, {
      api_host: apiHost || "/api/ph",
      defaults: "2026-01-30",
      autocapture: false,
      capture_pageview: true,
      capture_pageleave: true,
      persistence: "localStorage+cookie",
      session_recording: {
        maskAllInputs: true,
        recordBody: false,
        recordHeaders: false,
      },
      bootstrap: {
        distinctID: bootstrapDistinctId || undefined,
        featureFlags: bootstrapFlags || undefined,
      },
    });

    setPostHogClient(posthog);
    prevDistinctId.current = bootstrapDistinctId;
  }, [apiHost, bootstrapDistinctId, bootstrapFlags, key]);

  // Handle identity transitions (login/logout)
  useEffect(() => {
    if (!key) return;
    if (prevDistinctId.current === bootstrapDistinctId) return;

    const wasAuthenticated = prevDistinctId.current?.startsWith("cus_");
    const isAuthenticated = bootstrapDistinctId?.startsWith("cus_");

    if (isAuthenticated && !wasAuthenticated) {
      posthog.identify(bootstrapDistinctId!);
    } else if (!isAuthenticated && wasAuthenticated) {
      posthog.reset();
    }

    prevDistinctId.current = bootstrapDistinctId;
  }, [bootstrapDistinctId, key]);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
