// storefront/components/about/about-values.tsx
const values = [
  {
    name: "Quality without compromise",
    description:
      "Every product we carry is tested by our team before it reaches a customer. If we wouldn't use it ourselves, we don't sell it.",
  },
  {
    name: "Radical transparency",
    description:
      "No hidden fees, no fine print surprises. We show our pricing, our policies, and our supply chain as openly as we can.",
  },
  {
    name: "Customer-first returns",
    description:
      "We've made returns dead simple — no questions asked within 30 days. We'd rather lose a sale than lose your trust.",
  },
  {
    name: "Sustainable by default",
    description:
      "All packaging is recyclable or compostable. We offset carbon for every shipment and publish our annual impact report.",
  },
  {
    name: "Always improving",
    description:
      "We read every review and act on the feedback. Our product catalog, site experience, and support team get better each month.",
  },
  {
    name: "Built for humans",
    description:
      "Accessibility, plain language, and honest photography. We design everything so it works for real people, not just demos.",
  },
];

export function AboutValues() {
  return (
    <div className="mx-auto mt-32 max-w-7xl px-6 sm:mt-40 lg:px-8">
      <div className="mx-auto max-w-2xl lg:mx-0">
        <h2 className="text-pretty text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
          Our values
        </h2>
        <p className="mt-6 text-lg/8 text-gray-700">
          These aren&apos;t posters on a wall — they&apos;re the criteria we use when
          making every product, partnership, and policy decision.
        </p>
      </div>
      <dl className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 text-base/7 sm:grid-cols-2 lg:mx-0 lg:max-w-none lg:grid-cols-3">
        {values.map((value) => (
          <div key={value.name}>
            <dt className="font-semibold text-gray-900">{value.name}</dt>
            <dd className="mt-1 text-gray-600">{value.description}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
