import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { Modules } from "@medusajs/framework/utils";

export type TrackAnalyticsEventInput = {
  event: string;
  actor_id: string | null | undefined;
  actor_fallback: string | null | undefined;
  properties: Record<string, unknown>;
};

export const trackAnalyticsEventStep = createStep(
  "track-analytics-event",
  async (
    input: TrackAnalyticsEventInput | null,
    { container },
  ): Promise<StepResponse<void>> => {
    // Null guard — transforms return null when entity not found
    if (!input) return new StepResponse();

    // Graceful no-op when analytics module is not registered
    let analytics;
    try {
      analytics = container.resolve(Modules.ANALYTICS);
    } catch {
      return new StepResponse();
    }

    const resolvedActorId = input.actor_id || input.actor_fallback;
    if (!resolvedActorId) {
      const logger = container.resolve("logger");
      logger.warn(
        `[analytics] Skipping ${input.event}: no actor_id or fallback`,
      );
      return new StepResponse();
    }

    await analytics.track({
      event: input.event,
      actor_id: resolvedActorId,
      properties: input.properties,
    });

    return new StepResponse();
  },
);
