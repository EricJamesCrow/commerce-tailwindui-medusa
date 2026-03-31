"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  persistStorefrontConsentToDocument,
  readStorefrontConsentFromDocument,
} from "lib/consent/client";
import {
  createStorefrontConsentState,
  hasStoredConsentDecision,
  isAnalyticsConsentGranted,
  type StorefrontConsentState,
} from "lib/consent/shared";
import { CookieConsentBanner } from "./cookie-consent-banner";

type StorefrontConsentContextValue = {
  consent: StorefrontConsentState;
  analyticsEnabled: boolean;
  hasStoredDecision: boolean;
  openPreferences: () => void;
  grantAnalyticsConsent: () => void;
  denyAnalyticsConsent: () => void;
};

const StorefrontConsentContext =
  createContext<StorefrontConsentContextValue | null>(null);

type StorefrontConsentProviderProps = {
  children: ReactNode;
  initialConsent: StorefrontConsentState;
};

export function StorefrontConsentProvider({
  children,
  initialConsent,
}: StorefrontConsentProviderProps) {
  const initialState = useMemo(() => {
    const persisted =
      typeof document === "undefined"
        ? initialConsent
        : readStorefrontConsentFromDocument();

    return hasStoredConsentDecision(persisted) ? persisted : initialConsent;
  }, [initialConsent]);

  const [consent, setConsent] = useState<StorefrontConsentState>(initialState);
  const [isBannerOpen, setIsBannerOpen] = useState(
    !hasStoredConsentDecision(initialState),
  );

  function updateConsent(nextConsent: StorefrontConsentState) {
    setConsent(nextConsent);
    persistStorefrontConsentToDocument(nextConsent);
    setIsBannerOpen(false);
  }

  function grantAnalyticsConsent() {
    updateConsent(createStorefrontConsentState("granted"));
  }

  function denyAnalyticsConsent() {
    updateConsent(createStorefrontConsentState("denied"));
  }

  const value = useMemo<StorefrontConsentContextValue>(
    () => ({
      consent,
      analyticsEnabled: isAnalyticsConsentGranted(consent),
      hasStoredDecision: hasStoredConsentDecision(consent),
      openPreferences: () => setIsBannerOpen(true),
      grantAnalyticsConsent,
      denyAnalyticsConsent,
    }),
    [consent],
  );

  return (
    <StorefrontConsentContext.Provider value={value}>
      {children}
      <CookieConsentBanner
        consent={consent}
        isOpen={isBannerOpen}
        onAcceptAnalytics={grantAnalyticsConsent}
        onDeclineAnalytics={denyAnalyticsConsent}
        onClose={() => setIsBannerOpen(false)}
      />
    </StorefrontConsentContext.Provider>
  );
}

export function useStorefrontConsent(): StorefrontConsentContextValue {
  const context = useContext(StorefrontConsentContext);

  if (!context) {
    throw new Error(
      "useStorefrontConsent must be used within StorefrontConsentProvider",
    );
  }

  return context;
}

export function useOptionalStorefrontConsent(): StorefrontConsentContextValue | null {
  return useContext(StorefrontConsentContext);
}
