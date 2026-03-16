import {
  AbstractNotificationProviderService,
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

type ResendOptions = {
  api_key: string
  from: string
}

type InjectedDependencies = {
  logger: Logger
}

class ResendNotificationProviderService extends AbstractNotificationProviderService {
  static identifier = "notification-resend"
  private resendClient: Resend
  private options: ResendOptions
  private logger: Logger

  // Template map — templates are registered here as they're built.
  // Each key matches the `template` string passed via createNotifications().
  private templates: Record<string, React.FC<any>> = {
    "order-confirmation": OrderConfirmation,
    "password-reset": PasswordReset,
    "invite-user": InviteUser,
    "welcome": Welcome,
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
      throw new Error("Resend api_key is required in provider options")
    }
    if (!options.from) {
      throw new Error("Resend from email is required in provider options")
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

    const html = await render(
      React.createElement(Template, notification.data || {})
    )

    const subject =
      (notification.data as Record<string, any>)?.subject ??
      templateId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

    const { data, error } = await this.resendClient.emails.send({
      from: this.options.from,
      to: [notification.to],
      subject,
      html,
    })

    if (error || !data) {
      this.logger.error("Failed to send email", error ?? "unknown error")
      return {}
    }

    return { id: data.id }
  }
}

export default ResendNotificationProviderService
