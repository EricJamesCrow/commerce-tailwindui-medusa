import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { z } from "@medusajs/framework/zod";
import * as Sentry from "@sentry/node";
import { NEWSLETTER_MODULE } from "../../../../../modules/newsletter";
import NewsletterModuleService from "../../../../../modules/newsletter/service";
import { updateEmailPreferencesWorkflow } from "../../../../../workflows/newsletter/update-email-preferences";
import { EmailPreferencesSchema } from "../../../newsletter/validators";

type PostBody = z.infer<typeof EmailPreferencesSchema>;

function mapPreferences(
  email: string,
  subscriber?: {
    status?: "active" | "pending" | "unsubscribed" | null;
    order_updates_enabled?: boolean | null;
  } | null,
) {
  return {
    email,
    newsletter_enabled: subscriber?.status === "active",
    order_updates_enabled: subscriber?.order_updates_enabled ?? true,
  };
}

async function resolveCustomerEmail(
  req: AuthenticatedMedusaRequest,
): Promise<string> {
  const query = req.scope.resolve("query");
  const { data } = await query.graph({
    entity: "customer",
    fields: ["id", "email"],
    filters: {
      id: req.auth_context.actor_id,
    },
  });

  const customer = data[0];
  if (!customer?.email) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Customer not found");
  }

  return customer.email.trim().toLowerCase();
}

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) {
  try {
    const email = await resolveCustomerEmail(req);
    const newsletterService: NewsletterModuleService =
      req.scope.resolve(NEWSLETTER_MODULE);

    const [subscriber] = await newsletterService.listSubscribers(
      { email },
      { take: 1 },
    );

    res.status(200).json({
      preferences: mapPreferences(email, subscriber),
    });
  } catch (error) {
    if (error instanceof MedusaError) {
      throw error;
    }

    Sentry.captureException(error, {
      tags: {
        route: "customer_email_preferences",
        source: "account",
        method: "GET",
      },
      extra: {
        customer_id: req.auth_context.actor_id,
      },
      level: "warning",
    });
    throw error;
  }
}

export async function POST(
  req: AuthenticatedMedusaRequest<PostBody>,
  res: MedusaResponse,
) {
  try {
    const email = await resolveCustomerEmail(req);
    const { result } = await updateEmailPreferencesWorkflow(req.scope).run({
      input: {
        email,
        source: "account",
        customer_id: req.auth_context.actor_id,
        newsletter_enabled: req.validatedBody.newsletter_enabled,
        order_updates_enabled: req.validatedBody.order_updates_enabled,
      },
    });

    res.status(200).json({
      preferences: result,
    });
  } catch (error) {
    if (error instanceof MedusaError) {
      throw error;
    }

    Sentry.captureException(error, {
      tags: {
        route: "customer_email_preferences",
        source: "account",
        method: "POST",
      },
      extra: {
        customer_id: req.auth_context.actor_id,
        newsletter_enabled: req.validatedBody.newsletter_enabled,
        order_updates_enabled: req.validatedBody.order_updates_enabled,
      },
      level: "warning",
    });
    throw error;
  }
}
