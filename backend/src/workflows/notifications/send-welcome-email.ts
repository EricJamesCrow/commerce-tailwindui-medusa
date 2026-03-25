import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
  useQueryGraphStep,
  sendNotificationsStep,
} from "@medusajs/medusa/core-flows";
import { EmailTemplates } from "../../modules/resend/templates/template-registry";
import { defaultEmailConfig } from "../../modules/resend/templates/_config/email-config";

type SendWelcomeEmailInput = {
  id: string;
};

export const sendWelcomeEmailWorkflow = createWorkflow(
  "send-welcome-email",
  function (input: SendWelcomeEmailInput) {
    const { data: customers } = useQueryGraphStep({
      entity: "customer",
      fields: ["id", "email", "first_name", "last_name"],
      filters: { id: input.id },
    });

    const notifications = transform({ customers }, ({ customers: result }) => {
      const customer = result[0] as Record<string, any> | undefined;
      if (!customer?.email) {
        return [];
      }

      const storefrontUrl = process.env.STOREFRONT_URL;
      if (!storefrontUrl) {
        return [];
      }

      const baseUrl = storefrontUrl.replace(/\/$/, "");
      const customerName =
        [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
        null;

      const storeName = defaultEmailConfig.companyName;

      return [
        {
          to: customer.email as string,
          channel: "email" as const,
          template: EmailTemplates.WELCOME,
          data: {
            subject: `Welcome to ${storeName}`,
            customerName,
            shopUrl: baseUrl,
            accountUrl: `${baseUrl}/account`,
            storeName,
          },
          trigger_type: "customer.created",
          resource_id: customer.id as string,
          resource_type: "customer",
        },
      ];
    });

    sendNotificationsStep(notifications);

    return new WorkflowResponse({ customerId: input.id });
  },
);
