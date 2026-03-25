/**
 * Centralized email template registry.
 *
 * Template IDs are string constants used across subscribers, workflows,
 * and the provider service. This module provides type-safe keys and
 * the EmailTemplateId union type.
 */

export const EmailTemplates = {
  ORDER_CONFIRMATION: "order-confirmation",
  PASSWORD_RESET: "password-reset",
  INVITE_USER: "invite-user",
  WELCOME: "welcome",
  SHIPPING_CONFIRMATION: "shipping-confirmation",
  ORDER_CANCELED: "order-canceled",
  REFUND_CONFIRMATION: "refund-confirmation",
  ADMIN_ORDER_ALERT: "admin-order-alert",
  ABANDONED_CART: "abandoned-cart",
  NEWSLETTER_WELCOME: "newsletter-welcome",
  NEWSLETTER_WELCOME_BACK: "newsletter-welcome-back",
} as const;

export type EmailTemplateId =
  (typeof EmailTemplates)[keyof typeof EmailTemplates];
