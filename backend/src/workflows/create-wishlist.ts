import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
  createWishlistStep,
  type CreateWishlistStepInput,
} from "./steps/create-wishlist";

export const createWishlistWorkflow = createWorkflow(
  "create-wishlist",
  (input: CreateWishlistStepInput) => {
    const wishlist = createWishlistStep(input);
    return new WorkflowResponse({ wishlist });
  },
);
