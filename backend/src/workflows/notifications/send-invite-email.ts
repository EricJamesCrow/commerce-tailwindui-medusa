import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { Modules } from "@medusajs/framework/utils";
import { sendNotificationsStep } from "@medusajs/medusa/core-flows";
import { EmailTemplates } from "../../modules/resend/templates/template-registry";
import { defaultEmailConfig } from "../../modules/resend/templates/_config/email-config";

type SendInviteEmailInput = {
  id: string;
};

type InviteData = {
  id: string;
  email: string;
  token: string;
};

const retrieveInviteStep = createStep(
  "retrieve-invite",
  async (input: { id: string }, { container }) => {
    const userModuleService = container.resolve(Modules.USER);
    const invite = await userModuleService.retrieveInvite(input.id);
    return new StepResponse({
      id: invite.id,
      email: invite.email,
      token: invite.token,
    } as InviteData);
  },
);

export const sendInviteEmailWorkflow = createWorkflow(
  "send-invite-email",
  function (input: SendInviteEmailInput) {
    const invite = retrieveInviteStep({ id: input.id });

    const notifications = transform({ invite }, ({ invite: data }) => {
      if (!data.email || !data.token) {
        return [];
      }

      const backendUrl = process.env.MEDUSA_BACKEND_URL;
      if (!backendUrl) return [];

      const adminUrl = `${backendUrl.replace(/\/$/, "")}/app`;
      const inviteUrl = `${adminUrl}/invite?token=${encodeURIComponent(data.token)}`;
      const storeName = defaultEmailConfig.companyName;

      return [
        {
          to: data.email,
          channel: "email" as const,
          template: EmailTemplates.INVITE_USER,
          data: {
            subject: `You've been invited to join ${storeName}`,
            inviteUrl,
            storeName,
          },
          trigger_type: "invite.created",
          resource_id: data.id,
          resource_type: "invite",
        },
      ];
    });

    sendNotificationsStep(notifications);

    return new WorkflowResponse({ inviteId: input.id });
  },
);
