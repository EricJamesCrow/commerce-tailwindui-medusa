import type { Metadata } from "next";
import { ContactChannels } from "components/contact/contact-channels";
import { ContactForm } from "components/contact/contact-form";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with our team for customer support, returns, or wholesale inquiries.",
  alternates: {
    canonical: "/contact",
  },
};

export default function ContactPage() {
  return (
    <div className="isolate bg-white px-6 py-24 sm:py-32 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-balance text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
          Get in touch
        </h1>
        <p className="mt-2 text-lg/8 text-gray-600">
          We&apos;re here to help. Choose the right channel below or send us a
          message and we&apos;ll get back to you within one business day.
        </p>
      </div>
      <ContactChannels />
      <ContactForm />
    </div>
  );
}
