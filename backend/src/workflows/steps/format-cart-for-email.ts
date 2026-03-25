import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import {
  createCurrencyFormatter,
  formatItem,
} from "../notifications/_format-helpers";

export type AbandonedCartEmailData = {
  subject: string;
  customerName?: string;
  items: {
    name: string;
    variant?: string;
    quantity: number;
    price: string;
    imageUrl?: string;
  }[];
  subtotal: string;
  recoveryUrl: string;
  currencyCode: string;
};

type FormatCartForEmailInput = {
  cart: Record<string, any>;
  recoveryUrl: string;
};

export const formatCartForEmailStep = createStep(
  "format-cart-for-email",
  async (
    input: FormatCartForEmailInput,
  ): Promise<StepResponse<AbandonedCartEmailData>> => {
    const { cart, recoveryUrl } = input;

    const fmt = createCurrencyFormatter(cart.currency_code || "USD");
    const formatMoney = (amount: number) => fmt.format(amount);

    const items = ((cart.items || []) as Record<string, any>[]).map((item) =>
      formatItem(item, formatMoney),
    );

    const formatted: AbandonedCartEmailData = {
      subject: "You left something behind!",
      customerName: cart.customer?.first_name || undefined,
      items,
      subtotal: formatMoney(cart.item_subtotal ?? 0),
      recoveryUrl,
      currencyCode: cart.currency_code || "USD",
    };

    return new StepResponse(formatted);
  },
);
