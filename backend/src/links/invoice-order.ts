import { defineLink } from "@medusajs/framework/utils";
import InvoiceModule from "../modules/invoice";
import OrderModule from "@medusajs/medusa/order";

export default defineLink(
  {
    linkable: InvoiceModule.linkable.invoice,
    field: "order_id",
    isList: false,
  },
  OrderModule.linkable.order,
  {
    readOnly: true,
  },
);
