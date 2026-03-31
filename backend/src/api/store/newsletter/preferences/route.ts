import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { z } from "@medusajs/framework/zod";
import * as Sentry from "@sentry/node";
import { NEWSLETTER_MODULE } from "../../../../modules/newsletter";
import NewsletterModuleService from "../../../../modules/newsletter/service";
import { verifyEmailPreferencesToken } from "../../../../utils/email-preferences-token";
import { updateEmailPreferencesWorkflow } from "../../../../workflows/newsletter/update-email-preferences";
import {
  GetEmailPreferencesQuerySchema,
  TokenEmailPreferencesSchema,
} from "../validators";

type PostBody = z.infer<typeof TokenEmailPreferencesSchema>;
type GetQuery = z.infer<typeof GetEmailPreferencesQuerySchema>;

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

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { token } = req.validatedQuery as GetQuery;

  try {
    const email = verifyEmailPreferencesToken(token);
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
        route: "newsletter_preferences",
        source: "email_link",
        method: "GET",
      },
      extra: {
        has_token: Boolean(token),
      },
      level: "warning",
    });
    throw error;
  }
}

export async function POST(req: MedusaRequest<PostBody>, res: MedusaResponse) {
  const { token, newsletter_enabled, order_updates_enabled } =
    req.validatedBody;

  try {
    const email = verifyEmailPreferencesToken(token);
    const { result } = await updateEmailPreferencesWorkflow(req.scope).run({
      input: {
        email,
        source: "email_link",
        newsletter_enabled,
        order_updates_enabled,
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
        route: "newsletter_preferences",
        source: "email_link",
        method: "POST",
      },
      extra: {
        has_token: Boolean(token),
        newsletter_enabled,
        order_updates_enabled,
      },
      level: "warning",
    });
    throw error;
  }
}
