import { defineLink } from "@medusajs/framework/utils";
import WishlistModule from "../modules/wishlist";
import CustomerModule from "@medusajs/medusa/customer";

export default defineLink(
  {
    linkable: WishlistModule.linkable.wishlist,
    field: "customer_id",
    isList: false,
  },
  CustomerModule.linkable.customer,
  {
    readOnly: true,
  },
);
