# Company Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build three static company pages — About (`/about`), Contact (`/contact`), FAQ (`/faq`) — using TailwindPlus components, scaffolded with placeholder content.

**Architecture:** Three fully independent tracks (A: About, B: Contact, C: FAQ) that share zero files. Each page is a Next.js RSC route under `storefront/app/`, using named-export components co-located in `storefront/components/<page>/`. The contact form is the only `'use client'` component. All three tracks can be built in parallel git worktrees and dispatched as parallel subagents.

**Tech Stack:** Next.js 16 App Router (RSC-first), TailwindCSS v4 (indigo primary via `--color-primary-*` tokens), `@heroicons/react/24/outline`, `@headlessui/react`, Turbopack, Bun. Imports use bare paths (`components/...`, `lib/...`) — no `@/` prefix. Named exports only.

---

## Worktree Setup (run ONCE before dispatching subagents)

```bash
# 1. Create the Graphite feature branch (no -a: avoids committing unrelated staged changes)
cd /Users/itsjusteric/CrowCommerce/Templates/commerce-tailwindui-medusa
gt create -m "feat: add about, contact, and faq company pages"

# Confirm branch name, e.g. "03-30-feat_add_about_contact_and_faq_company_pages"
FEATURE_BRANCH=$(git branch --show-current)
echo "Feature branch: $FEATURE_BRANCH"

# 2. Create three worktrees — each gets its own temp branch based off this feature branch
git worktree add /tmp/worktrees/about -b wt/company-about $FEATURE_BRANCH
git worktree add /tmp/worktrees/contact -b wt/company-contact $FEATURE_BRANCH
git worktree add /tmp/worktrees/faq -b wt/company-faq $FEATURE_BRANCH
```

## Worktree Teardown (run AFTER all three subagents complete)

```bash
cd /Users/itsjusteric/CrowCommerce/Templates/commerce-tailwindui-medusa
FEATURE_BRANCH=$(git branch --show-current)

# Merge each worktree branch back (no conflicts — all files are distinct)
git merge wt/company-about --no-ff -m "chore: merge about page from worktree"
git merge wt/company-contact --no-ff -m "chore: merge contact page from worktree"
git merge wt/company-faq --no-ff -m "chore: merge faq page from worktree"

# Remove worktrees and temp branches
git worktree remove /tmp/worktrees/about
git worktree remove /tmp/worktrees/contact
git worktree remove /tmp/worktrees/faq
git branch -d wt/company-about wt/company-contact wt/company-faq

# Pre-submit checks
cd storefront && bun run prettier:check && cd ..
cd backend && bun run prettier:check && cd ..

# Submit
gt submit --stack --no-interactive
gh pr ready $(gh pr list --head $FEATURE_BRANCH --json number -q '.[0].number')
```

---

## File Map

### Track A — About Page

| File | Action |
|------|--------|
| `storefront/app/about/page.tsx` | Create — RSC route with metadata |
| `storefront/components/about/about-hero.tsx` | Create — hero with image tiles |
| `storefront/components/about/about-mission.tsx` | Create — mission text + stats |
| `storefront/components/about/about-values.tsx` | Create — values grid (6 items) |
| `storefront/components/about/about-team.tsx` | Create — team member grid |

### Track B — Contact Page

| File | Action |
|------|--------|
| `storefront/app/contact/page.tsx` | Create — RSC route with metadata |
| `storefront/components/contact/contact-channels.tsx` | Create — RSC, three support channels |
| `storefront/components/contact/contact-form.tsx` | Create — `'use client'` controlled form |

### Track C — FAQ Page

| File | Action |
|------|--------|
| `storefront/app/faq/page.tsx` | Create — RSC route with metadata |
| `storefront/components/faq/faq-section.tsx` | Create — two-column FAQ grid with intro |

---

## Track A — About Page

**Worktree:** `/tmp/worktrees/about`

All commands in this track run from `/tmp/worktrees/about`.

### Task A1: About hero component

**Files:**
- Create: `storefront/components/about/about-hero.tsx`

- [ ] **Step A1.1: Create the hero component**

```tsx
// storefront/components/about/about-hero.tsx
export function AboutHero() {
  return (
    <div className="relative isolate -z-10">
      <svg
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-[64rem] w-full stroke-gray-200 [mask-image:radial-gradient(32rem_32rem_at_center,white,transparent)]"
      >
        <defs>
          <pattern
            x="50%"
            y={-1}
            id="about-hero-pattern"
            width={200}
            height={200}
            patternUnits="userSpaceOnUse"
          >
            <path d="M.5 200V.5H200" fill="none" />
          </pattern>
        </defs>
        <svg x="50%" y={-1} className="overflow-visible fill-gray-50">
          <path
            d="M-200 0h201v201h-201Z M600 0h201v201h-201Z M-400 600h201v201h-201Z M200 800h201v201h-201Z"
            strokeWidth={0}
          />
        </svg>
        <rect
          fill="url(#about-hero-pattern)"
          width="100%"
          height="100%"
          strokeWidth={0}
        />
      </svg>
      <div
        aria-hidden="true"
        className="absolute left-1/2 right-0 top-0 -z-10 -ml-24 transform-gpu overflow-hidden blur-3xl lg:ml-24 xl:ml-48"
      >
        <div
          style={{
            clipPath:
              "polygon(63.1% 29.5%, 100% 17.1%, 76.6% 3%, 48.4% 0%, 44.6% 4.7%, 54.5% 25.3%, 59.8% 49%, 55.2% 57.8%, 44.4% 57.2%, 27.8% 47.9%, 35.1% 81.5%, 0% 97.7%, 39.2% 100%, 35.2% 81.4%, 97.2% 52.8%, 63.1% 29.5%)",
          }}
          className="aspect-[801/1036] w-[50.0625rem] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-30"
        />
      </div>
      <div className="overflow-hidden">
        <div className="mx-auto max-w-7xl px-6 pb-32 pt-36 sm:pt-60 lg:px-8 lg:pt-32">
          <div className="mx-auto max-w-2xl gap-x-14 lg:mx-0 lg:flex lg:max-w-none lg:items-center">
            <div className="relative w-full lg:max-w-xl lg:shrink-0 xl:max-w-2xl">
              <h1 className="text-pretty text-5xl font-semibold tracking-tight text-gray-900 sm:text-7xl">
                We craft products people love to use
              </h1>
              <p className="mt-8 text-pretty text-lg font-medium text-gray-500 sm:max-w-md sm:text-xl/8 lg:max-w-none">
                We&apos;re a small team building an e-commerce experience that puts
                customers first. From the first click to the final delivery, every
                detail matters to us.
              </p>
            </div>
            <div className="mt-14 flex justify-end gap-8 sm:-mt-44 sm:justify-start sm:pl-20 lg:mt-0 lg:pl-0">
              <div className="ml-auto w-44 flex-none space-y-8 pt-32 sm:ml-0 sm:pt-80 lg:order-last lg:pt-36 xl:order-none xl:pt-80">
                <div className="relative">
                  <img
                    alt="Team collaborating"
                    src="https://images.unsplash.com/photo-1557804506-669a67965ba0?ixlib=rb-4.0.3&auto=format&fit=crop&h=528&q=80"
                    className="aspect-[2/3] w-full rounded-xl bg-gray-900/5 object-cover shadow-lg"
                  />
                  <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-gray-900/10" />
                </div>
              </div>
              <div className="mr-auto w-44 flex-none space-y-8 sm:mr-0 sm:pt-52 lg:pt-36">
                <div className="relative">
                  <img
                    alt="Product detail"
                    src="https://images.unsplash.com/photo-1485217988980-11786ced9454?ixlib=rb-4.0.3&auto=format&fit=crop&h=528&q=80"
                    className="aspect-[2/3] w-full rounded-xl bg-gray-900/5 object-cover shadow-lg"
                  />
                  <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-gray-900/10" />
                </div>
                <div className="relative">
                  <img
                    alt="Packaging process"
                    src="https://images.unsplash.com/photo-1559136555-9303baea8ebd?ixlib=rb-4.0.3&auto=format&fit=crop&crop=focalpoint&fp-x=.4&w=396&h=528&q=80"
                    className="aspect-[2/3] w-full rounded-xl bg-gray-900/5 object-cover shadow-lg"
                  />
                  <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-gray-900/10" />
                </div>
              </div>
              <div className="w-44 flex-none space-y-8 pt-32 sm:pt-0">
                <div className="relative">
                  <img
                    alt="Workspace"
                    src="https://images.unsplash.com/photo-1670272504528-790c24957dda?ixlib=rb-4.0.3&auto=format&fit=crop&crop=left&w=400&h=528&q=80"
                    className="aspect-[2/3] w-full rounded-xl bg-gray-900/5 object-cover shadow-lg"
                  />
                  <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-gray-900/10" />
                </div>
                <div className="relative">
                  <img
                    alt="Studio"
                    src="https://images.unsplash.com/photo-1670272505284-8faba1c31f7d?ixlib=rb-4.0.3&auto=format&fit=crop&h=528&q=80"
                    className="aspect-[2/3] w-full rounded-xl bg-gray-900/5 object-cover shadow-lg"
                  />
                  <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-gray-900/10" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step A1.2: Commit**

```bash
cd /tmp/worktrees/about
git add storefront/components/about/about-hero.tsx
git commit -m "feat: add about hero with image tiles

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task A2: Mission and values components

**Files:**
- Create: `storefront/components/about/about-mission.tsx`
- Create: `storefront/components/about/about-values.tsx`

- [ ] **Step A2.1: Create the mission component**

```tsx
// storefront/components/about/about-mission.tsx
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
          <h2 className="text-pretty text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
            Our mission
          </h2>
          <div className="mt-6 flex flex-col gap-x-8 gap-y-20 lg:flex-row">
            <div className="lg:w-full lg:max-w-2xl lg:flex-auto">
              <p className="text-xl/8 text-gray-600">
                We believe great products shouldn&apos;t require a compromise between
                quality, design, and price. That conviction drives every decision we
                make — from the suppliers we choose to the packaging we ship in.
              </p>
              <p className="mt-10 max-w-xl text-base/7 text-gray-700">
                Founded by people who were frustrated with the status quo, we set out
                to build an online store that treats customers like adults. No dark
                patterns, no surprise fees, no nightmare returns. Just straightforward
                commerce done right, backed by a team that genuinely cares about the
                experience end to end.
              </p>
            </div>
            <div className="lg:flex lg:flex-auto lg:justify-center">
              <dl className="w-64 space-y-8 xl:w-80">
                {stats.map((stat) => (
                  <div key={stat.label} className="flex flex-col-reverse gap-y-4">
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
        <img
          alt="Our team at work"
          src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?ixlib=rb-4.0.3&auto=format&fit=crop&w=2832&q=80"
          className="aspect-[5/2] w-full object-cover outline outline-1 -outline-offset-1 outline-black/5 xl:rounded-3xl"
        />
      </div>
    </>
  );
}
```

- [ ] **Step A2.2: Create the values component**

```tsx
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
```

- [ ] **Step A2.3: Commit**

```bash
cd /tmp/worktrees/about
git add storefront/components/about/about-mission.tsx storefront/components/about/about-values.tsx
git commit -m "feat: add about mission and values sections

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task A3: Team component and page route

**Files:**
- Create: `storefront/components/about/about-team.tsx`
- Create: `storefront/app/about/page.tsx`

- [ ] **Step A3.1: Create the team component**

```tsx
// storefront/components/about/about-team.tsx
const team = [
  {
    name: "Alex Rivera",
    role: "Co-Founder / CEO",
    imageUrl:
      "https://images.unsplash.com/photo-1519244703995-f4e0f30006d5?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=8&w=1024&h=1024&q=80",
  },
  {
    name: "Jordan Kim",
    role: "Co-Founder / CTO",
    imageUrl:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=8&w=1024&h=1024&q=80",
  },
  {
    name: "Morgan Lee",
    role: "Head of Product",
    imageUrl:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=8&w=1024&h=1024&q=80",
  },
  {
    name: "Casey Nguyen",
    role: "Head of Design",
    imageUrl:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=8&w=1024&h=1024&q=80",
  },
  {
    name: "Sam Patel",
    role: "Customer Experience Lead",
    imageUrl:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=8&w=1024&h=1024&q=80",
  },
  {
    name: "Taylor Osei",
    role: "Operations Manager",
    imageUrl:
      "https://images.unsplash.com/photo-1517365830460-955ce3ccd263?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=8&w=1024&h=1024&q=80",
  },
];

export function AboutTeam() {
  return (
    <div className="mx-auto mt-32 max-w-7xl px-6 sm:mt-48 lg:px-8">
      <div className="mx-auto max-w-2xl lg:mx-0">
        <h2 className="text-pretty text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
          Our team
        </h2>
        <p className="mt-6 text-lg/8 text-gray-600">
          We&apos;re a small but mighty group of people who genuinely love what we do
          and hold each other to a high bar every day.
        </p>
      </div>
      <ul
        role="list"
        className="mx-auto mt-20 grid max-w-2xl grid-cols-2 gap-x-8 gap-y-16 text-center sm:grid-cols-3 md:grid-cols-4 lg:mx-0 lg:max-w-none lg:grid-cols-5 xl:grid-cols-6"
      >
        {team.map((person) => (
          <li key={person.name}>
            <img
              alt={person.name}
              src={person.imageUrl}
              className="mx-auto size-24 rounded-full outline outline-1 -outline-offset-1 outline-black/5"
            />
            <h3 className="mt-6 text-base/7 font-semibold tracking-tight text-gray-900">
              {person.name}
            </h3>
            <p className="text-sm/6 text-gray-600">{person.role}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step A3.2: Create the page route**

```tsx
// storefront/app/about/page.tsx
import type { Metadata } from "next";
import { AboutHero } from "components/about/about-hero";
import { AboutMission } from "components/about/about-mission";
import { AboutValues } from "components/about/about-values";
import { AboutTeam } from "components/about/about-team";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Learn about our mission, values, and the team behind CrowCommerce.",
  alternates: {
    canonical: "/about",
  },
};

export default function AboutPage() {
  return (
    <main className="isolate">
      <AboutHero />
      <AboutMission />
      <AboutValues />
      <AboutTeam />
      <div className="mt-32 sm:mt-48" />
    </main>
  );
}
```

- [ ] **Step A3.3: Verify it compiles**

```bash
cd /tmp/worktrees/about/storefront
bun run build 2>&1 | grep -E "(error|Error|warning|✓)" | head -20
```

Expected: no TypeScript or import errors. Build may fail on other unrelated issues — only care about errors in the files you just created.

- [ ] **Step A3.4: Commit**

```bash
cd /tmp/worktrees/about
git add storefront/components/about/about-team.tsx storefront/app/about/page.tsx
git commit -m "feat: add about team section and page route

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Track B — Contact Page

**Worktree:** `/tmp/worktrees/contact`

All commands in this track run from `/tmp/worktrees/contact`.

### Task B1: Contact channels and form components

**Files:**
- Create: `storefront/components/contact/contact-channels.tsx`
- Create: `storefront/components/contact/contact-form.tsx`

- [ ] **Step B1.1: Create the contact channels component (RSC)**

```tsx
// storefront/components/contact/contact-channels.tsx
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
```

- [ ] **Step B1.2: Create the contact form component (`'use client'`)**

```tsx
// storefront/components/contact/contact-form.tsx
"use client";

import { useState, type FormEvent } from "react";

type FormState = "idle" | "submitting" | "success" | "error";

export function ContactForm() {
  const [state, setState] = useState<FormState>("idle");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("submitting");
    // TODO: wire up to a real form backend (e.g. Resend, Formspree)
    setTimeout(() => setState("success"), 1000);
  }

  if (state === "success") {
    return (
      <div className="mx-auto max-w-xl rounded-2xl bg-green-50 px-8 py-10 text-center">
        <p className="text-base/7 font-semibold text-green-800">
          Message sent — thanks for reaching out!
        </p>
        <p className="mt-2 text-sm/6 text-green-700">
          We typically respond within one business day.
        </p>
        <button
          type="button"
          onClick={() => setState("idle")}
          className="mt-6 text-sm font-semibold text-indigo-600 hover:text-indigo-500"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto mt-16 max-w-xl sm:mt-20"
    >
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
        <div>
          <label
            htmlFor="first-name"
            className="block text-sm/6 font-semibold text-gray-900"
          >
            First name
          </label>
          <div className="mt-2.5">
            <input
              id="first-name"
              name="first-name"
              type="text"
              autoComplete="given-name"
              required
              className="block w-full rounded-md bg-white px-3.5 py-2 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600"
            />
          </div>
        </div>
        <div>
          <label
            htmlFor="last-name"
            className="block text-sm/6 font-semibold text-gray-900"
          >
            Last name
          </label>
          <div className="mt-2.5">
            <input
              id="last-name"
              name="last-name"
              type="text"
              autoComplete="family-name"
              required
              className="block w-full rounded-md bg-white px-3.5 py-2 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600"
            />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label
            htmlFor="email"
            className="block text-sm/6 font-semibold text-gray-900"
          >
            Email
          </label>
          <div className="mt-2.5">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="block w-full rounded-md bg-white px-3.5 py-2 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600"
            />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label
            htmlFor="subject"
            className="block text-sm/6 font-semibold text-gray-900"
          >
            Subject
          </label>
          <div className="mt-2.5">
            <input
              id="subject"
              name="subject"
              type="text"
              required
              className="block w-full rounded-md bg-white px-3.5 py-2 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600"
            />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label
            htmlFor="message"
            className="block text-sm/6 font-semibold text-gray-900"
          >
            Message
          </label>
          <div className="mt-2.5">
            <textarea
              id="message"
              name="message"
              rows={4}
              required
              className="block w-full rounded-md bg-white px-3.5 py-2 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600"
            />
          </div>
        </div>
      </div>
      <div className="mt-10">
        <button
          type="submit"
          disabled={state === "submitting"}
          className="block w-full rounded-md bg-indigo-600 px-3.5 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
        >
          {state === "submitting" ? "Sending…" : "Send message"}
        </button>
      </div>
      {state === "error" && (
        <p className="mt-4 text-center text-sm text-red-600">
          Something went wrong. Please try again or email us directly.
        </p>
      )}
    </form>
  );
}
```

- [ ] **Step B1.3: Commit**

```bash
cd /tmp/worktrees/contact
git add storefront/components/contact/contact-channels.tsx storefront/components/contact/contact-form.tsx
git commit -m "feat: add contact channels and form components

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task B2: Contact page route

**Files:**
- Create: `storefront/app/contact/page.tsx`

- [ ] **Step B2.1: Create the page route**

```tsx
// storefront/app/contact/page.tsx
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
```

- [ ] **Step B2.2: Verify it compiles**

```bash
cd /tmp/worktrees/contact/storefront
bun run build 2>&1 | grep -E "(error|Error)" | grep -v "node_modules" | head -20
```

Expected: no errors in contact-related files.

- [ ] **Step B2.3: Commit**

```bash
cd /tmp/worktrees/contact
git add storefront/app/contact/page.tsx
git commit -m "feat: add contact page route

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Track C — FAQ Page

**Worktree:** `/tmp/worktrees/faq`

All commands in this track run from `/tmp/worktrees/faq`.

### Task C1: FAQ section component

**Files:**
- Create: `storefront/components/faq/faq-section.tsx`

- [ ] **Step C1.1: Create the FAQ section component**

```tsx
// storefront/components/faq/faq-section.tsx
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
            <a
              href="/contact"
              className="font-semibold text-indigo-600 hover:text-indigo-500"
            >
              Reach out to our support team
            </a>{" "}
            and we&apos;ll get back to you as soon as we can.
          </p>
        </div>
        <div className="mt-20">
          <dl className="space-y-16 sm:grid sm:grid-cols-2 sm:gap-x-6 sm:gap-y-16 sm:space-y-0 lg:gap-x-10">
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
```

- [ ] **Step C1.2: Commit**

```bash
cd /tmp/worktrees/faq
git add storefront/components/faq/faq-section.tsx
git commit -m "feat: add faq section component with e-commerce Q&As

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task C2: FAQ page route

**Files:**
- Create: `storefront/app/faq/page.tsx`

- [ ] **Step C2.1: Create the page route**

```tsx
// storefront/app/faq/page.tsx
import type { Metadata } from "next";
import { FaqSection } from "components/faq/faq-section";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers to common questions about shipping, returns, products, and payments.",
  alternates: {
    canonical: "/faq",
  },
};

export default function FaqPage() {
  return <FaqSection />;
}
```

- [ ] **Step C2.2: Verify it compiles**

```bash
cd /tmp/worktrees/faq/storefront
bun run build 2>&1 | grep -E "(error|Error)" | grep -v "node_modules" | head -20
```

Expected: no errors in faq-related files.

- [ ] **Step C2.3: Commit**

```bash
cd /tmp/worktrees/faq
git add storefront/app/faq/page.tsx
git commit -m "feat: add faq page route

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Post-merge: Prettier + Submit

After the Worktree Teardown (cherry-picks done, worktrees removed), run from the main repo:

- [ ] **Step Z1: Fix any Prettier issues**

```bash
cd /Users/itsjusteric/CrowCommerce/Templates/commerce-tailwindui-medusa/storefront
bun run prettier
cd ..
```

- [ ] **Step Z2: Commit Prettier fixes if needed**

```bash
cd /Users/itsjusteric/CrowCommerce/Templates/commerce-tailwindui-medusa
git add storefront/components/about storefront/components/contact storefront/components/faq storefront/app/about storefront/app/contact storefront/app/faq
git diff --cached --quiet || git commit -m "style: prettier formatting on company pages

Co-Authored-By: Claude <noreply@anthropic.com>"
```

- [ ] **Step Z3: Submit**

```bash
gt submit --stack --no-interactive
gh pr ready $(gh pr list --head $(git branch --show-current) --json number -q '.[0].number')
```
