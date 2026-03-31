import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { emitEventStep } from "@medusajs/medusa/core-flows";
import { NEWSLETTER_MODULE } from "../../modules/newsletter";
import NewsletterModuleService from "../../modules/newsletter/service";
import {
  isUnsubscribeTokenExpired,
  issueUnsubscribeToken,
} from "../../utils/newsletter-token";

type UpdateEmailPreferencesInput = {
  email: string;
  source: "account" | "email_link";
  customer_id?: string;
  newsletter_enabled: boolean;
  order_updates_enabled: boolean;
};

type UpdateEmailPreferencesStepOutput = {
  subscriber: {
    id: string;
    email: string;
    status: "active" | "pending" | "unsubscribed";
    order_updates_enabled: boolean;
  };
  is_new_subscriber: boolean;
  previous_status: "active" | "pending" | "unsubscribed" | null;
  status_changed: boolean;
};

type CompensationData =
  | {
      operation: "create";
      id: string;
    }
  | {
      operation: "update";
      previous: {
        id: string;
        customer_id?: string | null;
        order_updates_enabled?: boolean | null;
        status: "active" | "pending" | "unsubscribed";
        unsubscribe_token?: string | null;
        unsubscribe_token_expires_at?: Date | null;
        unsubscribed_at?: Date | null;
      };
    };

type ExistingSubscriber = {
  id: string;
  customer_id?: string | null;
  email: string;
  order_updates_enabled?: boolean | null;
  status: "active" | "pending" | "unsubscribed";
  unsubscribe_token?: string | null;
  unsubscribe_token_expires_at?: Date | null;
  unsubscribed_at?: Date | null;
};

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Error &&
    (("code" in error && (error as { code?: string }).code === "23505") ||
      error.message.includes("unique") ||
      error.message.includes("duplicate"))
  );
}

async function findSubscriberByEmail(
  newsletterService: NewsletterModuleService,
  email: string,
): Promise<ExistingSubscriber | null> {
  const [subscriber] = await newsletterService.listSubscribers(
    { email },
    { take: 1 },
  );

  return (subscriber as ExistingSubscriber | undefined) ?? null;
}

function buildSubscriberUpdatePayload(
  existing: ExistingSubscriber,
  input: UpdateEmailPreferencesInput,
  nextStatus: "active" | "unsubscribed",
  unsubscribeCredential: {
    token: string;
    expiresAt: Date;
  } | null,
  nextUnsubscribedAt: Date | null,
) {
  return {
    id: existing.id,
    customer_id: input.customer_id || existing.customer_id || null,
    order_updates_enabled: input.order_updates_enabled,
    status: nextStatus,
    unsubscribe_token: input.newsletter_enabled
      ? (unsubscribeCredential?.token ?? existing.unsubscribe_token)
      : null,
    unsubscribe_token_expires_at: input.newsletter_enabled
      ? (unsubscribeCredential?.expiresAt ??
        existing.unsubscribe_token_expires_at)
      : null,
    unsubscribed_at: input.newsletter_enabled
      ? null
      : existing.status === "unsubscribed"
        ? (existing.unsubscribed_at ?? nextUnsubscribedAt)
        : nextUnsubscribedAt,
  };
}

function buildCompensationData(existing: ExistingSubscriber): CompensationData {
  return {
    operation: "update",
    previous: {
      id: existing.id,
      customer_id: existing.customer_id,
      order_updates_enabled: existing.order_updates_enabled,
      status: existing.status,
      unsubscribe_token: existing.unsubscribe_token,
      unsubscribe_token_expires_at: existing.unsubscribe_token_expires_at,
      unsubscribed_at: existing.unsubscribed_at,
    },
  } satisfies CompensationData;
}

const updateEmailPreferencesStep = createStep<
  UpdateEmailPreferencesInput,
  UpdateEmailPreferencesStepOutput,
  CompensationData
>(
  "update-email-preferences",
  async (input: UpdateEmailPreferencesInput, { container }) => {
    const newsletterService: NewsletterModuleService =
      container.resolve(NEWSLETTER_MODULE);
    const email = input.email.trim().toLowerCase();
    const nextStatus = input.newsletter_enabled ? "active" : "unsubscribed";
    const nextUnsubscribedAt = input.newsletter_enabled ? null : new Date();

    const existing = await findSubscriberByEmail(newsletterService, email);

    if (!existing) {
      const unsubscribeCredential = input.newsletter_enabled
        ? issueUnsubscribeToken()
        : null;

      try {
        const subscriber = await newsletterService.createSubscribers({
          email,
          source: input.source,
          customer_id: input.customer_id || null,
          order_updates_enabled: input.order_updates_enabled,
          status: nextStatus,
          unsubscribe_token: unsubscribeCredential?.token ?? null,
          unsubscribe_token_expires_at:
            unsubscribeCredential?.expiresAt ?? null,
          unsubscribed_at: nextUnsubscribedAt,
        });

        return new StepResponse<
          UpdateEmailPreferencesStepOutput,
          CompensationData
        >(
          {
            subscriber,
            is_new_subscriber: true,
            previous_status: null,
            status_changed: input.newsletter_enabled,
          },
          {
            operation: "create",
            id: subscriber.id,
          } satisfies CompensationData,
        );
      } catch (error) {
        if (!isUniqueViolation(error)) {
          throw error;
        }

        const winner = await findSubscriberByEmail(newsletterService, email);

        if (!winner) {
          throw error;
        }

        const shouldIssueToken =
          input.newsletter_enabled &&
          (!winner.unsubscribe_token ||
            isUnsubscribeTokenExpired(winner.unsubscribe_token_expires_at));
        const winnerCredential = shouldIssueToken
          ? issueUnsubscribeToken()
          : null;
        const subscriber = await newsletterService.updateSubscribers(
          buildSubscriberUpdatePayload(
            winner,
            input,
            nextStatus,
            winnerCredential,
            nextUnsubscribedAt,
          ),
        );

        return new StepResponse<
          UpdateEmailPreferencesStepOutput,
          CompensationData
        >(
          {
            subscriber,
            is_new_subscriber: false,
            previous_status: winner.status,
            status_changed: winner.status !== nextStatus,
          },
          buildCompensationData(winner),
        );
      }
    }

    const shouldIssueToken =
      input.newsletter_enabled &&
      (!existing.unsubscribe_token ||
        isUnsubscribeTokenExpired(existing.unsubscribe_token_expires_at));
    const unsubscribeCredential = shouldIssueToken
      ? issueUnsubscribeToken()
      : null;

    const subscriber = await newsletterService.updateSubscribers(
      buildSubscriberUpdatePayload(
        existing,
        input,
        nextStatus,
        unsubscribeCredential,
        nextUnsubscribedAt,
      ),
    );

    return new StepResponse<UpdateEmailPreferencesStepOutput, CompensationData>(
      {
        subscriber,
        is_new_subscriber: false,
        previous_status: existing.status,
        status_changed: existing.status !== nextStatus,
      },
      buildCompensationData(existing),
    );
  },
  async (compensationData, { container }) => {
    if (!compensationData) {
      return;
    }

    const newsletterService: NewsletterModuleService =
      container.resolve(NEWSLETTER_MODULE);

    if (compensationData.operation === "create") {
      await newsletterService.deleteSubscribers(compensationData.id);
      return;
    }

    const previous = compensationData.previous;

    await newsletterService.updateSubscribers({
      id: previous.id,
      customer_id: previous.customer_id ?? null,
      order_updates_enabled: previous.order_updates_enabled ?? true,
      status: previous.status,
      unsubscribe_token: previous.unsubscribe_token ?? null,
      unsubscribe_token_expires_at:
        previous.unsubscribe_token_expires_at ?? null,
      unsubscribed_at: previous.unsubscribed_at ?? null,
    });
  },
);

export const updateEmailPreferencesWorkflow = createWorkflow(
  "update-email-preferences",
  function (input: UpdateEmailPreferencesInput) {
    const result = updateEmailPreferencesStep(input);

    when(
      result,
      (data) => data.status_changed && data.subscriber.status === "active",
    ).then(() => {
      const eventData = transform({ result }, (data) => ({
        eventName: "newsletter.subscribed" as const,
        data: {
          id: data.result.subscriber.id,
          email: data.result.subscriber.email,
          isNewSubscriber: data.result.is_new_subscriber,
          wasReactivated: data.result.previous_status === "unsubscribed",
        },
      }));

      emitEventStep(eventData).config({
        name: "emit-email-preferences-subscribed",
      });
    });

    when(
      result,
      (data) =>
        data.status_changed && data.subscriber.status === "unsubscribed",
    ).then(() => {
      const eventData = transform({ result }, (data) => ({
        eventName: "newsletter.unsubscribed" as const,
        data: {
          id: data.result.subscriber.id,
        },
      }));

      emitEventStep(eventData).config({
        name: "emit-email-preferences-unsubscribed",
      });
    });

    const response = transform({ result }, (data) => ({
      email: data.result.subscriber.email,
      newsletter_enabled: data.result.subscriber.status === "active",
      order_updates_enabled: data.result.subscriber.order_updates_enabled,
    }));

    return new WorkflowResponse(response);
  },
);
