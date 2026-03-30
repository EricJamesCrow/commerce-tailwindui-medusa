import Link from "next/link";

const faqs = [
  // Shipping & Delivery
  {
    id: 1,
    question: "How long does standard shipping take?",
    answer:
      "Standard shipping takes 3–5 business days within the continental US. Expedited (1–2 business day) and overnight options are available at checkout.",
  },
  {
    id: 2,
    question: "Do you ship internationally?",
    answer:
      "Yes — we ship to 42 countries. International orders typically arrive in 7–14 business days. Duties and import taxes are the customer's responsibility and may apply at delivery.",
  },
  // Returns & Refunds
  {
    id: 3,
    question: "What is your return policy?",
    answer:
      "We offer free returns within 30 days of delivery — no questions asked. Items must be unused and in their original packaging. Start a return from your account dashboard or contact our support team.",
  },
  {
    id: 4,
    question: "How long does a refund take to process?",
    answer:
      "Refunds are issued within 2 business days of us receiving your return. Depending on your bank, the funds will appear in your account within 3–10 business days after that.",
  },
  // Products
  {
    id: 5,
    question: "Are your product photos accurate?",
    answer:
      "We use only natural light and unedited images so what you see matches what you get. Colors may vary slightly across different screen calibrations.",
  },
  {
    id: 6,
    question: "Do you restock sold-out items?",
    answer:
      "Most products are restocked on a regular cycle. Use the 'Notify me' button on any sold-out product page and we'll email you the moment it's back in stock.",
  },
  // Payment & Security
  {
    id: 7,
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit and debit cards (Visa, Mastercard, Amex, Discover), Apple Pay, Google Pay, and Shop Pay. All transactions are processed securely via Stripe.",
  },
  {
    id: 8,
    question: "Is my payment information stored?",
    answer:
      "We never store raw card numbers. When you save a card for future purchases, it is tokenized by Stripe and stored on their PCI-compliant servers — your details never touch ours.",
  },
];

export function FaqSection() {
  return (
    <div className="bg-white">
      <div className="mx-auto max-w-7xl px-6 py-16 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
            Frequently asked questions
          </h1>
          <p className="mt-6 text-base/7 text-gray-600">
            Can&apos;t find what you&apos;re looking for?{" "}
            <Link
              href="/contact"
              className="font-semibold text-indigo-600 hover:text-indigo-500"
            >
              Reach out to our support team
            </Link>{" "}
            and we&apos;ll get back to you as soon as we can.
          </p>
        </div>
        <div className="mt-20">
          <dl className="space-y-16 sm:grid sm:grid-cols-2 sm:space-y-0 sm:gap-x-6 sm:gap-y-16 lg:gap-x-10">
            {faqs.map((faq) => (
              <div key={faq.id}>
                <dt className="text-base/7 font-semibold text-gray-900">
                  {faq.question}
                </dt>
                <dd className="mt-2 text-base/7 text-gray-600">{faq.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
