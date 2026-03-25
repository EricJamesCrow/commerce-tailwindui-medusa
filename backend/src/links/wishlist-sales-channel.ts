import { defineLink } from "@medusajs/framework/utils";
import WishlistModule from "../modules/wishlist";
import SalesChannelModule from "@medusajs/medusa/sales-channel";

export default defineLink(
  {
    linkable: WishlistModule.linkable.wishlist,
    field: "sales_channel_id",
    isList: false,
  },
  SalesChannelModule.linkable.salesChannel,
  {
    readOnly: true,
  },
);
