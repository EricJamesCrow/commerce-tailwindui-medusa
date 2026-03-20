"use client"

import { useReportWebVitals } from "next/web-vitals"
import { useRef } from "react"

export function WebVitals() {
  const shouldSample = useRef(Math.random() < 0.1)

  useReportWebVitals((metric) => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return
    if (!shouldSample.current) return

    import("posthog-js").then((posthog) => {
      if (!posthog.default?.capture) return
      posthog.default.capture("web_vitals", {
        metric_name: metric.name,
        metric_value: metric.value,
        metric_rating: metric.rating,
        metric_delta: metric.delta,
        metric_id: metric.id,
        navigation_type: metric.navigationType,
      })
    })
  })

  return null
}
