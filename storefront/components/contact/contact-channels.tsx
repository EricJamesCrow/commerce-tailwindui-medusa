import {
  ChatBubbleLeftRightIcon,
  ArrowPathIcon,
  BuildingStorefrontIcon,
} from "@heroicons/react/24/outline";

const channels = [
  {
    icon: ChatBubbleLeftRightIcon,
    name: "Customer support",
    description:
      "Questions about your order, delivery status, or account? Our support team responds within one business day.",
    linkLabel: "Email support",
    href: "mailto:support@crowcommerce.com",
  },
  {
    icon: ArrowPathIcon,
    name: "Returns & refunds",
    description:
      "Need to return something? We make it easy — no questions asked within 30 days of delivery.",
    linkLabel: "Start a return",
    href: "mailto:returns@crowcommerce.com",
  },
  {
    icon: BuildingStorefrontIcon,
    name: "Wholesale inquiries",
    description:
      "Interested in carrying our products in your store or buying in bulk? We'd love to talk.",
    linkLabel: "Get in touch",
    href: "mailto:wholesale@crowcommerce.com",
  },
];

export function ContactChannels() {
  return (
    <div className="mx-auto mt-20 max-w-lg space-y-16">
      {channels.map((channel) => (
        <div key={channel.name} className="flex gap-x-6">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600">
            <channel.icon aria-hidden="true" className="size-6 text-white" />
          </div>
          <div>
            <h3 className="text-base/7 font-semibold text-gray-900">
              {channel.name}
            </h3>
            <p className="mt-2 text-base/7 text-gray-600">
              {channel.description}
            </p>
            <p className="mt-4 text-sm/6 font-semibold">
              <a href={channel.href} className="text-indigo-600 hover:text-indigo-500">
                {channel.linkLabel} <span aria-hidden="true">&rarr;</span>
              </a>
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
