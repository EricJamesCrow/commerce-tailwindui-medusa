// storefront/components/about/about-mission.tsx
import Image from "next/image";

const stats = [
  { label: "Products shipped to date", value: "12,000+" },
  { label: "Countries we deliver to", value: "42" },
  { label: "5-star customer reviews", value: "4,800+" },
];

export function AboutMission() {
  return (
    <>
      {/* Mission section */}
      <div className="mx-auto -mt-12 max-w-7xl px-6 sm:mt-0 lg:px-8 xl:-mt-8">
        <div className="mx-auto max-w-2xl lg:mx-0 lg:max-w-none">
          <h2 className="text-4xl font-semibold tracking-tight text-pretty text-gray-900 sm:text-5xl">
            Our mission
          </h2>
          <div className="mt-6 flex flex-col gap-x-8 gap-y-20 lg:flex-row">
            <div className="lg:w-full lg:max-w-2xl lg:flex-auto">
              <p className="text-xl/8 text-gray-600">
                We believe great products shouldn&apos;t require a compromise
                between quality, design, and price. That conviction drives every
                decision we make — from the suppliers we choose to the packaging
                we ship in.
              </p>
              <p className="mt-10 max-w-xl text-base/7 text-gray-700">
                Founded by people who were frustrated with the status quo, we
                set out to build an online store that treats customers like
                adults. No dark patterns, no surprise fees, no nightmare
                returns. Just straightforward commerce done right, backed by a
                team that genuinely cares about the experience end to end.
              </p>
            </div>
            <div className="lg:flex lg:flex-auto lg:justify-center">
              <dl className="w-64 space-y-8 xl:w-80">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="flex flex-col-reverse gap-y-4"
                  >
                    <dt className="text-base/7 text-gray-600">{stat.label}</dt>
                    <dd className="text-5xl font-semibold tracking-tight text-gray-900">
                      {stat.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Wide image banner */}
      <div className="mt-32 sm:mt-40 xl:mx-auto xl:max-w-7xl xl:px-8">
        <Image
          alt="Our team at work"
          src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?ixlib=rb-4.0.3&auto=format&fit=crop&w=2832&q=80"
          width={2832}
          height={1133}
          className="aspect-[5/2] w-full object-cover outline outline-1 -outline-offset-1 outline-black/5 xl:rounded-3xl"
        />
      </div>
    </>
  );
}
