import { model } from "@medusajs/framework/utils";

const Invoice = model
  .define("invoice", {
    id: model.id({ prefix: "inv" }).primaryKey(),
    display_id: model.number(),
    order_id: model.text().index("IDX_INVOICE_ORDER_ID"),
    year: model.number(),
    generated_at: model.dateTime(),
  })
  .indexes([
    {
      on: ["year", "display_id"],
      unique: true,
    },
  ]);

export default Invoice;
