import type {
  AggregateOffer,
  BreadcrumbList,
  ItemList,
  ListItem,
  Organization,
  Product as SchemaProduct,
  Review as SchemaReview,
  Thing,
  WithContext,
} from "schema-dts";
import { safeJsonLd } from "lib/json-ld";
import { createAbsoluteUrl } from "lib/utils";
import type { Product, ProductReviews } from "lib/types";

type BreadcrumbItem = {
  name: string;
  path: string;
};

type ItemListEntry = {
  position: number;
  name: string;
  path: string;
  image?: string;
};

export type SiteSchemaConfig = {
  name: string;
  legalName?: string;
  url: string;
  logoUrl?: string;
  description?: string;
  phone?: string;
  email?: string;
  sameAs?: string[];
};

const SCHEMA_CONTEXT = "https://schema.org" as const;

function toAbsoluteUrl(url: string): string {
  return new URL(url, createAbsoluteUrl("/")).toString();
}

function getReviewAuthorName(firstName: string, lastName: string): string {
  const trimmedFirstName = firstName.trim();
  const trimmedLastName = lastName.trim();
  const lastInitial = trimmedLastName ? ` ${trimmedLastName.charAt(0)}.` : "";
  return `${trimmedFirstName}${lastInitial}`.trim();
}

function getProductSku(product: Product): string | undefined {
  return product.variants.find((variant) => variant.sku)?.sku;
}

function buildReviewJsonLd(
  reviews: ProductReviews,
): SchemaReview[] | undefined {
  if (reviews.count === 0) return undefined;

  return reviews.reviews.slice(0, 5).map((review) => ({
    "@type": "Review",
    author: {
      "@type": "Person",
      name: getReviewAuthorName(review.first_name, review.last_name),
    },
    reviewRating: {
      "@type": "Rating",
      ratingValue: review.rating,
      bestRating: 5,
      worstRating: 1,
    },
    reviewBody: review.content,
    ...(review.title ? { headline: review.title } : {}),
    datePublished: review.created_at,
  }));
}

export function getSiteSchemaConfig(
  overrides: Partial<SiteSchemaConfig> = {},
): SiteSchemaConfig {
  const siteName = process.env.SITE_NAME || "Store";
  const sameAs = process.env.SITE_COMPANY_SAME_AS?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return {
    name: overrides.name || siteName,
    legalName: overrides.legalName || process.env.SITE_COMPANY_LEGAL_NAME,
    url: overrides.url || createAbsoluteUrl("/"),
    logoUrl:
      overrides.logoUrl ||
      (process.env.NEXT_PUBLIC_SITE_LOGO_URL
        ? toAbsoluteUrl(process.env.NEXT_PUBLIC_SITE_LOGO_URL)
        : undefined),
    description: overrides.description,
    phone: overrides.phone || process.env.SITE_COMPANY_PHONE,
    email: overrides.email || process.env.SITE_COMPANY_EMAIL,
    sameAs: overrides.sameAs || sameAs,
  };
}

export function buildProductJsonLd(
  product: Product,
  reviews: ProductReviews | null,
): WithContext<SchemaProduct> {
  const reviewEntries = reviews ? buildReviewJsonLd(reviews) : undefined;
  const sku = getProductSku(product);
  const productImages =
    product.images.length > 0 ? product.images : [product.featuredImage];

  const offers: AggregateOffer = {
    "@type": "AggregateOffer",
    lowPrice: product.priceRange.minVariantPrice.amount,
    highPrice: product.priceRange.maxVariantPrice.amount,
    priceCurrency: product.priceRange.minVariantPrice.currencyCode,
    offerCount: product.variants.length,
    availability: product.availableForSale
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock",
    url: createAbsoluteUrl(`/product/${product.handle}`),
  };

  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: productImages.map((image) => toAbsoluteUrl(image.url)),
    url: createAbsoluteUrl(`/product/${product.handle}`),
    ...(sku ? { sku } : {}),
    offers,
    ...(reviews && reviews.count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: reviews.averageRating.toFixed(1),
            reviewCount: reviews.count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    ...(reviewEntries ? { review: reviewEntries } : {}),
  };
}

export function buildBreadcrumbJsonLd(
  items: BreadcrumbItem[],
): WithContext<BreadcrumbList> {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: items.map(
      (item, index): ListItem => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        item: createAbsoluteUrl(item.path),
      }),
    ),
  };
}

export function buildItemListJsonLd(
  items: ItemListEntry[],
): WithContext<ItemList> {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "ItemList",
    itemListElement: items.map(
      (item): ListItem => ({
        "@type": "ListItem",
        position: item.position,
        url: createAbsoluteUrl(item.path),
        item: {
          "@type": "Thing",
          name: item.name,
          url: createAbsoluteUrl(item.path),
          ...(item.image ? { image: toAbsoluteUrl(item.image) } : {}),
        },
      }),
    ),
  };
}

export function buildOrganizationJsonLd(
  siteConfig: SiteSchemaConfig,
): WithContext<Organization> {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
    ...(siteConfig.legalName ? { legalName: siteConfig.legalName } : {}),
    ...(siteConfig.logoUrl ? { logo: siteConfig.logoUrl } : {}),
    ...(siteConfig.description ? { description: siteConfig.description } : {}),
    ...(siteConfig.sameAs?.length ? { sameAs: siteConfig.sameAs } : {}),
    ...(siteConfig.phone || siteConfig.email
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            ...(siteConfig.phone ? { telephone: siteConfig.phone } : {}),
            ...(siteConfig.email ? { email: siteConfig.email } : {}),
            contactType: "customer support",
          },
        }
      : {}),
  };
}

export function JsonLdScript({
  data,
}: {
  data: WithContext<Thing> | WithContext<ItemList> | WithContext<Organization>;
}) {
  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  );
}
