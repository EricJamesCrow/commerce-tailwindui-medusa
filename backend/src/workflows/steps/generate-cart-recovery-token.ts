import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { createHmac } from "node:crypto";
import { resolveStorefrontUrl } from "../../subscribers/_helpers/resolve-urls";

type GenerateCartRecoveryTokenInput = {
  cart_id: string;
};

type GenerateCartRecoveryTokenOutput = {
  token: string;
  recoveryUrl: string;
};

export const generateCartRecoveryTokenStep = createStep(
  "generate-cart-recovery-token",
  async (
    input: GenerateCartRecoveryTokenInput,
  ): Promise<StepResponse<GenerateCartRecoveryTokenOutput>> => {
    const secret = process.env.CART_RECOVERY_SECRET;
    if (!secret) {
      throw new Error(
        "CART_RECOVERY_SECRET env var is required for abandoned cart recovery",
      );
    }

    const token = createHmac("sha256", secret)
      .update(input.cart_id)
      .digest("hex");

    const storefrontUrl = resolveStorefrontUrl() || "http://localhost:3000";
    const recoveryUrl = `${storefrontUrl}/cart/recover/${input.cart_id}?token=${token}`;

    return new StepResponse({ token, recoveryUrl });
  },
);
