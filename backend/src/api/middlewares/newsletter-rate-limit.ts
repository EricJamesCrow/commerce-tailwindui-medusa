import * as Sentry from "@sentry/node";
import type { RequestHandler } from "express";
import Redis from "ioredis";
import { getClientIp } from "./client-ip";

const MAX_REQUESTS = 5;
const WINDOW_SECONDS = 60; // 1 minute

let redis: Redis | null = null;
let warned = false;

// In-process fallback when Redis is unavailable
const inProcessStore = new Map<string, { count: number; resetAt: number }>();
let warnedFallback = false;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.REDIS_URL;
  if (!url) {
    if (!warned) {
      console.warn(
        "[newsletter-rate-limit] REDIS_URL not set — rate limiting disabled",
      );
      warned = true;
    }
    return null;
  }
  try {
    redis = new Redis(url, { maxRetriesPerRequest: 1 });
    redis.on("error", (err) => {
      console.warn("[newsletter-rate-limit] Redis error:", err.message);
    });
    return redis;
  } catch (e) {
    Sentry.captureException(e, {
      tags: { middleware: "newsletter_rate_limit", step: "redis_connect" },
      level: "warning",
    });
    return null;
  }
}

export function newsletterRateLimit(): RequestHandler {
  return async (req, res, next) => {
    const ip = getClientIp(req);
    if (!ip) return next();

    const key = `newsletter_sub:${ip}`;
    const client = getRedis();

    if (!client) {
      // In-process fallback
      if (!warnedFallback) {
        console.warn(
          "[newsletter-rate-limit] Redis unavailable — using in-process rate limiting (degraded mode, not shared across instances)",
        );
        warnedFallback = true;
      }

      const now = Date.now();
      const entry = inProcessStore.get(key);

      if (entry && entry.resetAt > now) {
        entry.count += 1;
        if (entry.count > MAX_REQUESTS) {
          const ttl = Math.ceil((entry.resetAt - now) / 1000);
          res.set("Retry-After", String(ttl));
          res.status(429).json({
            message: "Too many requests. Please try again later.",
            type: "too_many_requests",
          });
          return;
        }
      } else {
        // Expired or missing — create fresh entry
        inProcessStore.set(key, {
          count: 1,
          resetAt: now + WINDOW_SECONDS * 1000,
        });
      }

      return next();
    }

    try {
      // Atomic INCR-first pattern — avoids GET-then-INCR race condition
      const count = await client.incr(key);
      if (count === 1) {
        await client.expire(key, WINDOW_SECONDS);
      }
      if (count > MAX_REQUESTS) {
        const ttl = await client.ttl(key);
        res.set("Retry-After", String(ttl > 0 ? ttl : WINDOW_SECONDS));
        res.status(429).json({
          message: "Too many requests. Please try again later.",
          type: "too_many_requests",
        });
        return;
      }
    } catch (e) {
      Sentry.captureException(e, {
        tags: { middleware: "newsletter_rate_limit", step: "redis_incr" },
        level: "warning",
      });
      return next();
    }

    next();
  };
}
