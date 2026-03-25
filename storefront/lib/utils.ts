import type {
  Collection as TailwindCollection,
  Product as TailwindProduct,
} from "components/home/types";
import { ReadonlyURLSearchParams } from "next/navigation";
import type { Collection, Product } from "./types";

function normalizeBaseUrl(url: string): string {
  const sanitizedUrl = url.replace(/[\r\n]+/g, "").trim();
  return sanitizedUrl.endsWith("/") ? sanitizedUrl.slice(0, -1) : sanitizedUrl;
}

export const baseUrl = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000"),
);

export function createAbsoluteUrl(path: string): string {
  return new URL(path, `${baseUrl}/`).toString();
}

export const createUrl = (
  pathname: string,
  params: URLSearchParams | ReadonlyURLSearchParams,
) => {
  const paramsString = params.toString();
  const queryString = `${paramsString.length ? "?" : ""}${paramsString}`;

  return `${pathname}${queryString}`;
};

export const ensureStartsWith = (stringToCheck: string, startsWith: string) =>
  stringToCheck.startsWith(startsWith)
    ? stringToCheck
    : `${startsWith}${stringToCheck}`;

export const validateEnvironmentVariables = () => {
  const requiredEnvironmentVariables = [
    "MEDUSA_BACKEND_URL",
    "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY",
  ];
  const missingEnvironmentVariables = [] as string[];

  requiredEnvironmentVariables.forEach((envVar) => {
    if (!process.env[envVar]) {
      missingEnvironmentVariables.push(envVar);
    }
  });

  if (missingEnvironmentVariables.length) {
    throw new Error(
      `The following environment variables are missing. Your site will not work without them.\n\n${missingEnvironmentVariables.join(
        "\n",
      )}\n`,
    );
  }
};

// Transform Product to Tailwind Product format
export const transformProductToTailwind = (
  product: Product,
): TailwindProduct => {
  // Extract color variants from product variants where option name is "Color"
  const colorOptions = product.variants
    .map((variant) => {
      const colorOption = variant.selectedOptions.find(
        (option) => option.name.toLowerCase() === "color",
      );
      return colorOption ? colorOption.value : null;
    })
    .filter((value, index, self) => value && self.indexOf(value) === index); // unique values only

  // Map colors to format expected by Tailwind component
  const availableColors = colorOptions.map((colorName) => ({
    name: colorName as string,
    colorBg: getColorHex(colorName as string), // Helper to convert color names to hex
  }));

  // Get first variant's color for the default display
  const firstColorOption = product.variants[0]?.selectedOptions.find(
    (option) => option.name.toLowerCase() === "color",
  );
  const defaultColor = firstColorOption?.value || "";

  // Format price with currency symbol
  const price = product.variants[0]?.price
    ? `$${parseFloat(product.variants[0].price.amount).toFixed(2)}`
    : "$0.00";

  return {
    id:
      parseInt(product.id.replace(/\D/g, "")) ||
      Math.floor(Math.random() * 100000), // Extract numeric ID or generate random
    name: product.title,
    color: defaultColor,
    price,
    href: `/product/${product.handle}`,
    imageSrc: product.images[0]?.url || "https://via.placeholder.com/400",
    imageAlt: product.images[0]?.altText || product.title,
    availableColors: availableColors.length > 0 ? availableColors : [],
  };
};

// Transform Collection to Tailwind Collection format
export const transformCollectionToTailwind = (
  collection: Collection,
): TailwindCollection => {
  return {
    name: collection.title,
    description: collection.description || collection.seo.description,
    imageSrc: collection.image?.url || "https://via.placeholder.com/800",
    imageAlt: collection.image?.altText || collection.title,
    href: collection.path,
  };
};

// Helper function to convert color names to hex codes
// NOTE: These color values are also defined in tailwind.config.ts under theme.extend.colors.variants
// Keep both locations in sync when adding new product variant colors
export const getColorHex = (colorName: string): string => {
  const colorMap: Record<string, string> = {
    black: "#111827",
    white: "#FFFFFF",
    gray: "#6B7280",
    grey: "#6B7280",
    red: "#DC2626",
    blue: "#2563EB",
    green: "#059669",
    yellow: "#F59E0B",
    orange: "#EA580C",
    purple: "#9333EA",
    pink: "#EC4899",
    brown: "#7C2D12",
    beige: "#FEF3C7",
    navy: "#1E3A8A",
    cream: "#FEF3C7",
    tan: "#D2B48C",
    olive: "#6B7237",
    maroon: "#7F1D1D",
    teal: "#0D9488",
    indigo: "#4F46E5",
    brass: "#FDE68A",
    chrome: "#E5E7EB",
    natural: "#FEF3C7",
    salmon: "#FA8072",
    matte: "#4B5563",
  };

  const normalizedColor = colorName.toLowerCase().trim();
  return colorMap[normalizedColor] || "#9CA3AF"; // Default gray if color not found
};

// Transform Collections to footer products format
export const transformCollectionsToFooterProducts = (
  collections: Collection[],
): { name: string; href: string }[] => {
  return collections.map((collection) => ({
    name: collection.title,
    href: collection.path,
  }));
};

// Types for Tailwind product components
export type TailwindProductDetail = {
  name: string;
  price: string;
  priceAmount: string;
  priceCurrency: string;
  rating: number;
  images: Array<{ id: number; name: string; src: string; alt: string }>;
  colors: Array<{ id: string; name: string; classes: string }>;
  description: string;
  details: Array<{ name: string; items: string[] }>;
};

export type TailwindRelatedProduct = {
  id: number;
  name: string;
  color: string;
  href: string;
  imageSrc: string;
  imageAlt: string;
  price: string;
  variantId: string;
};

// Transform Product to Tailwind Product Detail format
export const transformProductToTailwindDetail = (
  product: Product,
  averageRating?: number,
): TailwindProductDetail => {
  // Map images to Tailwind format
  const images = product.images.map((image, index) => ({
    id: index + 1,
    name: image.altText || `View ${index + 1}`,
    src: image.url,
    alt: image.altText || product.title,
  }));

  // Extract color variants
  const colorVariants = product.variants
    .map((variant) => {
      const colorOption = variant.selectedOptions.find(
        (option) => option.name.toLowerCase() === "color",
      );
      return colorOption ? { value: colorOption.value, variant } : null;
    })
    .filter(
      (item, index, self) =>
        item && self.findIndex((t) => t && t.value === item.value) === index,
    );

  // Map colors to Tailwind format with CSS classes
  const colors = colorVariants.map((item) => {
    const colorName = item!.value;
    const colorHex = getColorHex(colorName);
    const isLight = isLightColor(colorHex);

    return {
      id: colorName.toLowerCase().replace(/\s+/g, "-"),
      name: colorName,
      classes: `bg-[${colorHex}] ${isLight ? "checked:outline-gray-400" : "checked:outline-gray-700"}`,
    };
  });

  // Format price
  const price = product.variants[0]?.price
    ? `$${parseFloat(product.variants[0].price.amount).toFixed(2)}`
    : "$0.00";

  // Store raw price data for proper formatting
  const priceAmount = product.variants[0]?.price?.amount || "0";
  const priceCurrency = product.variants[0]?.price?.currencyCode || "USD";

  // Create default product details sections
  const details = [
    {
      name: "Features",
      items: [
        "Premium quality materials",
        "Durable construction",
        "Modern design",
        "Versatile usage",
      ],
    },
    {
      name: "Care",
      items: [
        "Spot clean as needed",
        "Handle with care",
        "Store in a cool, dry place",
        "Avoid direct sunlight",
      ],
    },
    {
      name: "Shipping",
      items: [
        "Free shipping on orders over $300",
        "International shipping available",
        "Expedited shipping options",
        "Signature required upon delivery",
      ],
    },
    {
      name: "Returns",
      items: [
        "Easy return requests",
        "Pre-paid shipping label included",
        "10% restocking fee for returns",
        "60 day return window",
      ],
    },
  ];

  return {
    name: product.title,
    price,
    priceAmount,
    priceCurrency,
    rating: averageRating ?? 0,
    images:
      images.length > 0
        ? images
        : [
            {
              id: 1,
              name: "Product image",
              src: "https://via.placeholder.com/600",
              alt: product.title,
            },
          ],
    colors: colors.length > 0 ? colors : [],
    description: product.description || `<p>${product.title}</p>`,
    details,
  };
};

// Transform Products to Tailwind Related Products format
export const transformProductsToRelatedProducts = (
  products: Product[],
): TailwindRelatedProduct[] => {
  return products.slice(0, 4).map((product, index) => {
    // Get first color variant if available
    const colorVariant = product.variants.find((variant) =>
      variant.selectedOptions.some(
        (option) => option.name.toLowerCase() === "color",
      ),
    );
    const colorOption = colorVariant?.selectedOptions.find(
      (option) => option.name.toLowerCase() === "color",
    );

    // Format price
    const price = product.variants[0]?.price
      ? `$${parseFloat(product.variants[0].price.amount).toFixed(2)}`
      : "$0.00";

    return {
      id: parseInt(product.id.replace(/\D/g, "")) || index + 1,
      name: product.title,
      color: colorOption?.value || "",
      href: `/product/${product.handle}`,
      imageSrc: product.images[0]?.url || "https://via.placeholder.com/400",
      imageAlt: product.images[0]?.altText || product.title,
      price,
      variantId: product.variants[0]?.id || "",
    };
  });
};

// Helper to check if a color is light (for contrast determination)
const isLightColor = (hex: string): boolean => {
  // Remove # if present
  const color = hex.replace("#", "");

  // Convert to RGB
  const r = parseInt(color.substr(0, 2), 16);
  const g = parseInt(color.substr(2, 2), 16);
  const b = parseInt(color.substr(4, 2), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5;
};
