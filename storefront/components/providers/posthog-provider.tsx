"use client";

import { useEffect, useRef } from "react";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { setPostHogClient } from "lib/analytics";
import { sanitizeEnvValue } from "lib/env";

type Props = {
  children: React.ReactNode;
  analyticsEnabled: boolean;
  bootstrapDistinctId: string | null;
  bootstrapFlags?: Record<string, boolean | string>;
};

export function PostHogProvider({
  children,
  analyticsEnabled,
  bootstrapDistinctId,
  bootstrapFlags,
}: Props) {
  const hasInitialized = useRef(false);
  const prevDistinctId = useRef<string | null>(null);
  const key = sanitizeEnvValue(process.env.NEXT_PUBLIC_POSTHOG_KEY);
  const apiHost = sanitizeEnvValue(process.env.NEXT_PUBLIC_POSTHOG_HOST);

  useEffect(() => {
    if (!key) return;
    if (!analyticsEnabled) {
      if (hasInitialized.current) {
        posthog.opt_out_capturing();
        posthog.stopSessionRecording();
      }
      return;
    }

    if (!hasInitialized.current) {
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
      hasInitialized.current = true;
      prevDistinctId.current = bootstrapDistinctId;
      return;
    }

    if (posthog.has_opted_out_capturing()) {
      posthog.opt_in_capturing();
      if (!posthog.sessionRecordingStarted()) {
        posthog.startSessionRecording();
      }
    }
  }, [analyticsEnabled, apiHost, bootstrapDistinctId, bootstrapFlags, key]);

  // Handle identity transitions (login/logout)
  useEffect(() => {
    if (!key || !analyticsEnabled || !hasInitialized.current) return;
    if (prevDistinctId.current === bootstrapDistinctId) return;

    const wasAuthenticated = prevDistinctId.current?.startsWith("cus_");
    const isAuthenticated = bootstrapDistinctId?.startsWith("cus_");

    if (isAuthenticated && !wasAuthenticated) {
      posthog.identify(bootstrapDistinctId!);
    } else if (!isAuthenticated && wasAuthenticated) {
      posthog.reset();
    }

    prevDistinctId.current = bootstrapDistinctId;
  }, [analyticsEnabled, bootstrapDistinctId, key]);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
