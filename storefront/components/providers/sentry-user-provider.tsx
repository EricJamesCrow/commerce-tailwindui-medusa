"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export function SentryUserProvider({
  customerId,
}: {
  customerId: string | null;
}) {
  useEffect(() => {
    Sentry.setUser(customerId ? { id: customerId } : null);
  }, [customerId]);

  return null;
}
