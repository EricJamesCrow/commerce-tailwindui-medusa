import { model } from "@medusajs/framework/utils";

export const Subscriber = model
  .define("newsletter_subscriber", {
    id: model.id({ prefix: "nsub" }).primaryKey(),
    email: model.text(),
    status: model.enum(["active", "pending", "unsubscribed"]).default("active"),
    source: model.enum(["footer", "checkout", "account", "import"]),
    customer_id: model.text().nullable(),
    resend_contact_id: model.text().nullable(),
    unsubscribed_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      on: ["email"],
      unique: true,
    },
  ]);
