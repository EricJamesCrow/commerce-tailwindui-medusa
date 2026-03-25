import {
  defineMiddlewares,
  authenticate,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import multer from "multer";
import { authRateLimit } from "./middlewares/rate-limit";
import { newsletterRateLimit } from "./middlewares/newsletter-rate-limit";
import { PostStoreReviewSchema } from "./store/reviews/route";
import { PostAdminUpdateReviewsStatusSchema } from "./admin/reviews/status/route";
import { PostAdminReviewResponseSchema } from "./admin/reviews/[id]/response/route";
import { GetAdminReviewsSchema } from "./admin/reviews/route";
import { GetStoreReviewsSchema } from "./store/products/[id]/reviews/route";
import {
  WishlistNameSchema,
  PostCreateWishlistItemSchema,
} from "./store/customers/me/wishlists/validators";
import {
  PostGuestCreateWishlistItemSchema,
  PostImportWishlistSchema,
} from "./store/wishlists/validators";
import { PostAdminInvoiceConfigSchema } from "./admin/invoice-config/route";
import {
  SubscribeSchema,
  UnsubscribeSchema,
} from "./store/newsletter/validators";
import * as Sentry from "@sentry/node";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Only JPEG, PNG, and WebP images are allowed",
        ),
      );
    }
  },
});

export default defineMiddlewares({
  errorHandler: (error, req, res, next) => {
    Sentry.withScope((scope) => {
      const actorId =
        "auth_context" in req
          ? (req as { auth_context?: { actor_id?: string } }).auth_context
              ?.actor_id
          : undefined;
      if (actorId) {
        scope.setUser({ id: actorId });
      }
      scope.setTag("method", req.method);
      scope.setTag("path", req.path);
      Sentry.captureException(error);
    });
    next(error);
  },
  routes: [
    // --- Trust proxy for correct IP detection behind reverse proxy ---
    {
      matcher: "/auth*",
      middlewares: [
        (req, _res, next) => {
          req.app.set("trust proxy", true);
          next();
        },
      ],
    },
    // --- Normalize email to lowercase before auth (case-sensitive matching) ---
    {
      matcher: "/auth/*/emailpass*",
      method: ["POST"],
      middlewares: [
        (req, _res, next) => {
          const body = req.body as Record<string, unknown>;
          if (body?.email && typeof body.email === "string") {
            body.email = body.email.toLowerCase();
          }
          next();
        },
      ],
    },
    // --- Auth rate limiting ---
    {
      matcher: "/auth/customer/emailpass*",
      method: ["POST"],
      middlewares: [authRateLimit()],
    },
    {
      matcher: "/auth/user/emailpass*",
      method: ["POST"],
      middlewares: [authRateLimit()],
    },
    // --- Saved payment methods — auth required ---
    {
      matcher: "/store/payment-methods/:account_holder_id",
      method: "GET",
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    // --- Store review routes ---
    {
      method: ["POST"],
      matcher: "/store/reviews",
      middlewares: [
        authenticate("customer", ["session", "bearer"]),
        validateAndTransformBody(PostStoreReviewSchema),
      ],
    },
    {
      method: ["POST"],
      matcher: "/store/reviews/uploads",
      middlewares: [
        authenticate("customer", ["session", "bearer"]),
        upload.array("files", 3) as any,
      ],
    },
    {
      matcher: "/store/products/:id/reviews",
      method: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetStoreReviewsSchema, {
          isList: true,
          defaults: [
            "id",
            "rating",
            "title",
            "first_name",
            "last_name",
            "content",
            "created_at",
            "images.*",
            "response.*",
          ],
        }),
      ],
    },
    // --- Admin review routes ---
    {
      matcher: "/admin/reviews",
      method: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetAdminReviewsSchema, {
          isList: true,
          defaults: [
            "id",
            "title",
            "content",
            "rating",
            "product_id",
            "customer_id",
            "status",
            "created_at",
            "updated_at",
            "product.*",
            "response.*",
          ],
        }),
      ],
    },
    {
      matcher: "/admin/reviews/status",
      method: ["POST"],
      middlewares: [
        validateAndTransformBody(PostAdminUpdateReviewsStatusSchema),
      ],
    },
    {
      matcher: "/admin/reviews/:id/response",
      method: ["POST"],
      middlewares: [validateAndTransformBody(PostAdminReviewResponseSchema)],
    },
    // --- Customer wishlist routes — auth on all paths ---
    {
      matcher: "/store/customers/me/wishlists*",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    // Body validation for specific customer wishlist mutations
    {
      matcher: "/store/customers/me/wishlists",
      method: ["POST"],
      middlewares: [validateAndTransformBody(WishlistNameSchema)],
    },
    {
      matcher: "/store/customers/me/wishlists/:id",
      method: ["PUT"],
      middlewares: [validateAndTransformBody(WishlistNameSchema)],
    },
    {
      matcher: "/store/customers/me/wishlists/:id/items",
      method: ["POST"],
      middlewares: [validateAndTransformBody(PostCreateWishlistItemSchema)],
    },
    // Guest wishlist routes — no auth required
    {
      matcher: "/store/wishlists/:id/items",
      method: ["POST"],
      middlewares: [
        validateAndTransformBody(PostGuestCreateWishlistItemSchema),
      ],
    },
    // Import route — requires auth
    {
      matcher: "/store/wishlists/import",
      method: ["POST"],
      middlewares: [
        authenticate("customer", ["session", "bearer"]),
        validateAndTransformBody(PostImportWishlistSchema),
      ],
    },
    // --- Store invoice routes ---
    {
      method: ["GET"],
      matcher: "/store/orders/:id/invoice",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    // --- Admin invoice routes ---
    {
      method: ["GET"],
      matcher: "/admin/orders/:id/invoice",
      middlewares: [], // Admin auth is automatic
    },
    {
      method: ["POST"],
      matcher: "/admin/invoice-config",
      middlewares: [validateAndTransformBody(PostAdminInvoiceConfigSchema)],
    },
    // --- Newsletter routes ---
    {
      matcher: "/store/newsletter/subscribe",
      method: ["POST"],
      middlewares: [
        newsletterRateLimit(),
        authenticate("customer", ["session", "bearer"], {
          allowUnauthenticated: true,
        }),
        (req, _res, next) => {
          const body = req.body as Record<string, unknown>;
          if (body?.email && typeof body.email === "string") {
            body.email = body.email.toLowerCase();
          }
          next();
        },
        validateAndTransformBody(SubscribeSchema),
      ],
    },
    {
      matcher: "/store/newsletter/unsubscribe",
      method: ["POST"],
      middlewares: [
        newsletterRateLimit(),
        validateAndTransformBody(UnsubscribeSchema),
      ],
    },
  ],
});
