import { createHash } from "node:crypto";
import { createElement } from "react";
import {
  createWorkflow,
  createStep,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { render } from "@react-email/render";
import { Resend } from "resend";
import { ContactFormMessage } from "../../modules/resend/templates/contact-form-message";
import { defaultEmailConfig } from "../../modules/resend/templates/_config/email-config";

type SendContactFormMessageInput = {
  first_name: string;
  last_name: string;
  email: string;
  subject: string;
  message: string;
};

const sendContactFormEmailStep = createStep(
  "send-contact-form-email",
  async (input: SendContactFormMessageInput, { container }) => {
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL;
    const supportEmail = defaultEmailConfig.supportEmail;

    if (!apiKey || !fromEmail) {
      throw new Error("Resend contact form email is not configured");
    }

    if (!supportEmail) {
      throw new Error("Contact form support inbox is not configured");
    }

    const resend = new Resend(apiKey);
    const logger = container.resolve("logger");
    const submitterName = `${input.first_name} ${input.last_name}`.trim();
    const idempotencyKey = createHash("sha256")
      .update(`${input.email}:${input.subject}:${input.message}`)
      .digest("hex");
    const submittedAt = new Date()
      .toISOString()
      .replace("T", " ")
      .replace("Z", " UTC");

    const html = await render(
      createElement(ContactFormMessage, {
        submitterName,
        submitterEmail: input.email,
        subjectLine: input.subject,
        message: input.message,
        submittedAt,
      }),
    );

    const { data, error } = await resend.emails.send(
      {
        from: fromEmail,
        to: [supportEmail],
        replyTo: input.email,
        subject: `Contact form: ${input.subject}`,
        html,
        tags: [{ name: "source", value: "contact_form" }],
      },
      {
        idempotencyKey: `contact-form/${idempotencyKey}`,
      },
    );

    if (error || !data?.id) {
      logger.warn(
        `[contact] Failed to send contact form email: ${
          error?.message || "missing email id"
        }`,
      );
      throw new Error(
        `Failed to send contact form email: ${error?.message || "missing email id"}`,
      );
    }

    return new StepResponse({ emailId: data.id });
  },
);

export const sendContactFormMessageWorkflow = createWorkflow(
  "send-contact-form-message",
  function (input: SendContactFormMessageInput) {
    const result = sendContactFormEmailStep(input);

    return new WorkflowResponse(result);
  },
);
