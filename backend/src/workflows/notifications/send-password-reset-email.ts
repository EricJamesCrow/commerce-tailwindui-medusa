import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { sendNotificationsStep } from "@medusajs/medusa/core-flows";
import { EmailTemplates } from "../../modules/resend/templates/template-registry";

type SendPasswordResetEmailInput = {
  email: string;
  token: string;
  actorType: "customer" | "user";
};

export const sendPasswordResetEmailWorkflow = createWorkflow(
  "send-password-reset-email",
  function (input: SendPasswordResetEmailInput) {
    const notifications = transform({ input }, ({ input: data }) => {
      const params = `token=${encodeURIComponent(data.token)}&email=${encodeURIComponent(data.email)}`;

      let resetUrl: string | null = null;

      if (data.actorType === "customer") {
        const storefrontUrl = process.env.STOREFRONT_URL;
        if (!storefrontUrl) return [];
        resetUrl = `${storefrontUrl.replace(/\/$/, "")}/account/reset-password?${params}`;
      } else {
        const backendUrl = process.env.MEDUSA_BACKEND_URL;
        if (!backendUrl) return [];
        resetUrl = `${backendUrl.replace(/\/$/, "")}/app/reset-password?${params}`;
      }

      const subject =
        data.actorType === "customer"
          ? "Reset Your Password"
          : "Reset Your Admin Password";

      return [
        {
          to: data.email,
          channel: "email" as const,
          template: EmailTemplates.PASSWORD_RESET,
          data: {
            subject,
            resetUrl,
            email: data.email,
            actorType: data.actorType,
          },
          trigger_type: "auth.password_reset",
          resource_type: data.actorType,
        },
      ];
    });

    sendNotificationsStep(notifications);

    return new WorkflowResponse({ email: input.email });
  },
);
