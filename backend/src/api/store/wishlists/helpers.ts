import type {
  MedusaRequest,
  MedusaResponse,
  MedusaStoreRequest,
} from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { createHmac, timingSafeEqual } from "crypto";
import jwt, { TokenExpiredError } from "jsonwebtoken";

/**
 * Verifies a JWT share token and returns the embedded wishlist_id.
 * Throws MedusaError on invalid, expired, or malformed tokens.
 */
export function verifyShareToken(
  req: MedusaRequest,
  token: string,
  expiredMessage = "This share link has expired",
): string {
  const { http } = req.scope.resolve("configModule").projectConfig;
  if (!http.jwtSecret) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "JWT secret is not configured",
    );
  }

  let decoded: unknown;
  try {
    decoded = jwt.verify(token, http.jwtSecret);
  } catch (e) {
    if (e instanceof TokenExpiredError) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, expiredMessage);
    }
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Invalid share token",
    );
  }

  if (
    typeof decoded !== "object" ||
    decoded === null ||
    !("wishlist_id" in decoded) ||
    typeof (decoded as Record<string, unknown>).wishlist_id !== "string"
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Invalid share token",
    );
  }

  return (decoded as { wishlist_id: string }).wishlist_id;
}

/**
 * Returns the cookie secret from the Medusa config.
 */
function getCookieSecret(req: MedusaRequest): string {
  const { http } = req.scope.resolve("configModule").projectConfig;
  if (!http.cookieSecret) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Cookie secret is not configured",
    );
  }
  return http.cookieSecret;
}

/**
 * Signs a wishlist ID using HMAC-SHA256 with the cookie secret.
 */
function signWishlistId(wishlistId: string, secret: string): string {
  return createHmac("sha256", secret).update(wishlistId).digest("hex");
}

const GUEST_WISHLIST_COOKIE = "guest_wishlist_id";

/**
 * Sets a signed httpOnly cookie associating the guest with this wishlist.
 * Call this when creating a new guest wishlist.
 */
export function setGuestWishlistCookie(
  req: MedusaRequest,
  res: MedusaResponse,
  wishlistId: string,
): void {
  const secret = getCookieSecret(req);
  const signature = signWishlistId(wishlistId, secret);
  const value = `${wishlistId}.${signature}`;

  res.cookie(GUEST_WISHLIST_COOKIE, value, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    path: "/",
  });
}

/**
 * Verifies that the requesting client owns the guest wishlist via signed cookie.
 * Also verifies the wishlist exists and has no customer_id.
 * Throws MedusaError if ownership cannot be verified.
 */
export async function requireGuestWishlistOwnership(
  req: MedusaRequest,
  wishlistId: string,
): Promise<void> {
  const secret = getCookieSecret(req);
  const cookieValue = req.cookies?.[GUEST_WISHLIST_COOKIE];

  if (!cookieValue) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Guest wishlist access denied",
    );
  }

  const parts = cookieValue.split(".");
  if (parts.length !== 2) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Guest wishlist access denied",
    );
  }

  const [cookieWishlistId, signature] = parts;
  if (cookieWishlistId !== wishlistId) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Guest wishlist access denied",
    );
  }

  const expectedSignature = signWishlistId(wishlistId, secret);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (
    sigBuf.length !== expectedBuf.length ||
    !timingSafeEqual(sigBuf, expectedBuf)
  ) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Guest wishlist access denied",
    );
  }

  // Also verify it's actually a guest wishlist
  const query = req.scope.resolve("query");
  const { data } = await query.graph({
    entity: "wishlist",
    fields: ["id"],
    filters: { id: wishlistId, customer_id: null },
  });

  if (!data.length) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Wishlist not found");
  }
}

/**
 * Verifies that the given wishlist ID belongs to a guest wishlist
 * (customer_id is null). Throws MedusaError if not found.
 * @deprecated Use requireGuestWishlistOwnership for mutation routes.
 */
export async function requireGuestWishlist(
  req: MedusaRequest,
  wishlistId: string,
): Promise<void> {
  const query = req.scope.resolve("query");
  const { data } = await query.graph({
    entity: "wishlist",
    fields: ["id"],
    filters: { id: wishlistId, customer_id: null },
  });

  if (!data.length) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Wishlist not found");
  }
}

/**
 * Extracts the first sales channel ID from the publishable key context.
 * Throws MedusaError if no sales channel is present.
 */
export function requireSalesChannelId(
  req:
    | MedusaStoreRequest
    | { publishable_key_context?: { sales_channel_ids: string[] } },
): string {
  const [salesChannelId] = req.publishable_key_context?.sales_channel_ids ?? [];
  if (!salesChannelId) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "At least one sales channel ID is required",
    );
  }
  return salesChannelId;
}
