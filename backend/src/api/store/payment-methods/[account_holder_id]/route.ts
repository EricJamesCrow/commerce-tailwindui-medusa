import { MedusaError } from "@medusajs/framework/utils";
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) {
  const { account_holder_id } = req.params;
  const customerId = req.auth_context.actor_id;

  const query = req.scope.resolve("query");
  const paymentModuleService = req.scope.resolve("payment");

  // Fetch account holder with its linked customer to verify ownership
  const {
    data: [accountHolder],
  } = await query.graph({
    entity: "account_holder",
    fields: ["data", "provider_id", "customer.*"],
    filters: { id: account_holder_id },
  });

  if (!accountHolder) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Account holder not found",
    );
  }

  // Verify the account holder belongs to the authenticated customer
  const linkedCustomer = (accountHolder as { customer?: { id: string } })
    .customer;
  if (!linkedCustomer || linkedCustomer.id !== customerId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Account holder not found",
    );
  }

  if (!accountHolder.data) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Account holder data not available",
    );
  }

  const paymentMethods = await paymentModuleService.listPaymentMethods({
    provider_id: accountHolder.provider_id,
    context: {
      account_holder: {
        data: { id: accountHolder.data.id },
      },
    },
  });

  res.json({ payment_methods: paymentMethods });
}
