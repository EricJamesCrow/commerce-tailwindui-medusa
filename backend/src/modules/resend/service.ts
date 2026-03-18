import {
  AbstractNotificationProviderService,
  MedusaError,
} from "@medusajs/framework/utils"
import type {
  Logger,
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
} from "@medusajs/framework/types"
import React from "react"
import { Resend } from "resend"
import { render } from "@react-email/render"
import { OrderConfirmation } from "./templates/order-confirmation"
import { PasswordReset } from "./templates/password-reset"
import { InviteUser } from "./templates/invite-user"
import { Welcome } from "./templates/welcome"
import { ShippingConfirmation } from "./templates/shipping-confirmation"
import { OrderCanceled } from "./templates/order-canceled"
import { RefundConfirmation } from "./templates/refund-confirmation"
import { AdminOrderAlert } from "./templates/admin-order-alert"
import { AbandonedCart } from "./templates/abandoned-cart"

type ResendOptions = {
  api_key: string
  from: string
}

type InjectedDependencies = {
  logger: Logger
}

/** Caller-controlled email options passed via notification.data.emailOptions */
type EmailOptions = {
  from?: string
  replyTo?: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  tags?: Array<{ name: string; value: string }>
  text?: string
  headers?: Record<string, string>
  scheduledAt?: string
}

/** File attachment passed via notification.data.attachments */
type EmailAttachment = {
  content?: string | Buffer
  filename?: string
  path?: string
  content_type?: string
}

class ResendNotificationProviderService extends AbstractNotificationProviderService {
  static identifier = "notification-resend"
  private resendClient: Resend
  private options: ResendOptions
  private logger: Logger

  private templates: Record<string, React.FC<any>> = {
    "order-confirmation": OrderConfirmation,
    "password-reset": PasswordReset,
    "invite-user": InviteUser,
    "welcome": Welcome,
    "shipping-confirmation": ShippingConfirmation,
    "order-canceled": OrderCanceled,
    "refund-confirmation": RefundConfirmation,
    "admin-order-alert": AdminOrderAlert,
    "abandoned-cart": AbandonedCart,
  }

  /** Default subjects per template — callers can override via notification.data.subject */
  private templateSubjects: Record<string, string> = {
    "order-confirmation": "Order Confirmed",
    "password-reset": "Reset Your Password",
    "invite-user": "You've Been Invited",
    "welcome": "Welcome!",
    "shipping-confirmation": "Your Order Has Shipped",
    "order-canceled": "Order Canceled",
    "refund-confirmation": "Refund Processed",
    "admin-order-alert": "New Order Received",
    "abandoned-cart": "You Left Something Behind",
  }

  constructor(
    { logger }: InjectedDependencies,
    options: ResendOptions
  ) {
    super()
    this.resendClient = new Resend(options.api_key)
    this.options = options
    this.logger = logger
  }

  static validateOptions(options: Record<string, any>) {
    if (!options.api_key) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Resend api_key is required in provider options"
      )
    }
    if (!options.from) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Resend from email is required in provider options"
      )
    }
  }

  async send(
    notification: ProviderSendNotificationDTO
  ): Promise<ProviderSendNotificationResultsDTO> {
    const templateId = notification.template
    const Template = this.templates[templateId]

    if (!Template) {
      this.logger.error(
        `Email template "${templateId}" not found. ` +
        `Available: ${Object.keys(this.templates).join(", ") || "(none)"}`
      )
      return {}
    }

    // Separate email routing metadata from template props
    const {
      subject: callerSubject,
      emailOptions: rawEmailOptions,
      attachments: rawAttachments,
      ...templateData
    } = (notification.data || {}) as Record<string, any>

    const html = await render(
      React.createElement(Template, templateData)
    )

    // Subject precedence: caller > centralized default > auto-generated from ID
    const subject =
      callerSubject ??
      this.templateSubjects[templateId] ??
      templateId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

    const emailOptions = (rawEmailOptions as EmailOptions) ?? {}
    const attachments = rawAttachments as EmailAttachment[] | undefined

    const { data, error } = await this.resendClient.emails.send({
      from: emailOptions.from ?? this.options.from,
      to: [notification.to],
      subject,
      html,
      ...(emailOptions.replyTo && { reply_to: emailOptions.replyTo }),
      ...(emailOptions.cc && { cc: emailOptions.cc }),
      ...(emailOptions.bcc && { bcc: emailOptions.bcc }),
      ...(emailOptions.tags && { tags: emailOptions.tags }),
      ...(emailOptions.text && { text: emailOptions.text }),
      ...(emailOptions.headers && { headers: emailOptions.headers }),
      ...(emailOptions.scheduledAt && { scheduled_at: emailOptions.scheduledAt }),
      ...(attachments?.length && {
        attachments: attachments.map((a) => ({
          ...(a.content != null && { content: a.content }),
          ...(a.filename && { filename: a.filename }),
          ...(a.path && { path: a.path }),
          ...(a.content_type && { content_type: a.content_type }),
        })),
      }),
    })

    if (error || !data) {
      this.logger.error("Failed to send email", error ?? "unknown error")
      return {}
    }

    return { id: data.id }
  }
}

export default ResendNotificationProviderService
