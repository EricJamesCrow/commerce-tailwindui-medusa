import * as Sentry from "@sentry/node";
import type { RequestHandler } from "express";
import Redis from "ioredis";

const MAX_REQUESTS = 3;
const WINDOW_SECONDS = 10 * 60;
const WINDOW_MS = WINDOW_SECONDS * 1000;
const REDIS_INCREMENT_WITH_TTL_SCRIPT = `
  local current = redis.call("INCR", KEYS[1])
  if current == 1 then
    redis.call("EXPIRE", KEYS[1], ARGV[1])
  end
  return current
`;

let redis: Redis | null = null;
let warnedMissingRedis = false;
let warnedFallback = false;

type InProcessEntry = { count: number; resetAt: number };

const inProcessStore = new Map<string, InProcessEntry>();

function getClientIp(req: Parameters<RequestHandler>[0]): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    const [firstIp] = forwarded.split(",");
    if (firstIp?.trim()) {
      return firstIp.trim();
    }
  }

  return req.ip || req.socket.remoteAddress || null;
}

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.REDIS_URL;
  if (!url) {
    if (!warnedMissingRedis) {
      console.warn(
        "[contact-rate-limit] REDIS_URL not set — using in-process fallback",
      );
      warnedMissingRedis = true;
    }
    return null;
  }

  try {
    redis = new Redis(url, { maxRetriesPerRequest: 1 });
    redis.on("error", (error) => {
      console.warn("[contact-rate-limit] Redis error:", error.message);
    });
    return redis;
  } catch (error) {
    Sentry.captureException(error, {
      tags: { middleware: "contact_rate_limit", step: "redis_connect" },
      level: "warning",
    });
    return null;
  }
}

function pruneExpiredInProcessEntries(now: number) {
  for (const [key, entry] of inProcessStore) {
    if (entry.resetAt <= now) {
      inProcessStore.delete(key);
    }
  }
}

function upsertInProcessEntry(key: string, now: number): InProcessEntry {
  pruneExpiredInProcessEntries(now);

  const entry = inProcessStore.get(key);
  if (entry) {
    entry.count += 1;
    return entry;
  }

  const nextEntry = {
    count: 1,
    resetAt: now + WINDOW_MS,
  };
  inProcessStore.set(key, nextEntry);
  return nextEntry;
}

async function incrementRedisEntry(client: Redis, key: string) {
  return Number(
    await client.eval(REDIS_INCREMENT_WITH_TTL_SCRIPT, 1, key, WINDOW_SECONDS),
  );
}

export const contactRateLimitTestUtils = {
  getInProcessEntry(key: string) {
    return inProcessStore.get(key);
  },
  resetInProcessStore() {
    inProcessStore.clear();
  },
  pruneExpiredInProcessEntries,
  upsertInProcessEntry,
  incrementRedisEntry,
};

export function contactRateLimit(): RequestHandler {
  return async (req, res, next) => {
    const ip = getClientIp(req);
    if (!ip) {
      return next();
    }

    const key = `contact_form:${ip}`;
    const client = getRedis();

    if (!client) {
      if (!warnedFallback) {
        console.warn(
          "[contact-rate-limit] Redis unavailable — using in-process rate limiting (degraded mode, not shared across instances)",
        );
        warnedFallback = true;
      }

      const now = Date.now();
      const entry = upsertInProcessEntry(key, now);

      if (entry.count > MAX_REQUESTS) {
        const ttl = Math.ceil((entry.resetAt - now) / 1000);
        res.set("Retry-After", String(ttl));
        res.status(429).json({
          message: "Too many contact submissions. Please try again later.",
          type: "too_many_requests",
        });
        return;
      }

      return next();
    }

    try {
      const count = await incrementRedisEntry(client, key);

      if (count > MAX_REQUESTS) {
        const ttl = await client.ttl(key);
        res.set("Retry-After", String(ttl > 0 ? ttl : WINDOW_SECONDS));
        res.status(429).json({
          message: "Too many contact submissions. Please try again later.",
          type: "too_many_requests",
        });
        return;
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: { middleware: "contact_rate_limit", step: "redis_incr" },
        level: "warning",
      });
      return next();
    }

    next();
  };
}
