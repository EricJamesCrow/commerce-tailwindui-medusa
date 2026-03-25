import { getOrder } from "lib/medusa";
import { retrieveCustomer } from "lib/medusa/customer";
import { notFound } from "next/navigation";
import { OrderDetail } from "components/account/order-detail";
import { trackServer } from "lib/analytics-server";
import Link from "next/link";

export const metadata = {
  title: "Order Details",
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const [order, customer] = await Promise.all([
    getOrder(orderId),
    retrieveCustomer(),
  ]);

  if (!order) {
    notFound();
  }

  if (!customer || (order.customer_id && order.customer_id !== customer.id)) {
    notFound();
  }

  try {
    await trackServer("order_detail_viewed", {
      order_id: order.id,
      display_id: order.display_id ?? 0,
      item_count: order.items?.length ?? 0,
    });
  } catch {}

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/account/orders"
          className="text-primary-600 hover:text-primary-500 text-sm font-medium"
        >
          <span aria-hidden="true">&larr;</span> Back to orders
        </Link>
      </div>
      <OrderDetail order={order} />
    </div>
  );
}
