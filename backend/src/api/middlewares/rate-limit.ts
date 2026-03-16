import type { RequestHandler } from "express"
import Redis from "ioredis"

const MAX_ATTEMPTS = 5
const WINDOW_SECONDS = 900 // 15 minutes

let redis: Redis | null = null
let warned = false

function getRedis(): Redis | null {
  if (redis) return redis
  const url = process.env.REDIS_URL
  if (!url) {
    if (!warned) {
      console.warn("[rate-limit] REDIS_URL not set — auth rate limiting disabled")
      warned = true
    }
    return null
  }
  try {
    redis = new Redis(url, { maxRetriesPerRequest: 1 })
    redis.on("error", (err) => {
      console.warn("[rate-limit] Redis error — auth rate limiting may be unavailable:", err.message)
    })
    return redis
  } catch {
    return null
  }
}

function keyFor(ip: string): string {
  return `auth_fail:${ip}`
}

export function authRateLimit(): RequestHandler {
  return async (req, res, next) => {
    const client = getRedis()
    if (!client) return next()

    const ip = req.ip || req.socket.remoteAddress
    if (!ip) {
      console.warn(
        "[rate-limit] Could not determine client IP — skipping rate limit.",
        "x-forwarded-for:", req.headers["x-forwarded-for"],
        "remoteAddress:", req.socket.remoteAddress,
        "req.ip:", req.ip,
      )
      return next()
    }
    const key = keyFor(ip)

    try {
      const count = await client.get(key)
      if (count && parseInt(count, 10) >= MAX_ATTEMPTS) {
        const ttl = await client.ttl(key)
        res.set("Retry-After", String(ttl > 0 ? ttl : WINDOW_SECONDS))
        res.status(429).json({
          message: "Too many failed attempts. Please try again later.",
          type: "too_many_requests",
        })
        return
      }
    } catch {
      // Redis read failed — pass through
      return next()
    }

    // Intercept response to track failures
    res.on("finish", () => {
      if (res.statusCode === 401) {
        client
          .multi()
          .incr(key)
          .expire(key, WINDOW_SECONDS)
          .exec()
          .catch(() => {})
      } else if (res.statusCode >= 200 && res.statusCode < 300) {
        client.del(key).catch(() => {})
      }
    })

    next()
  }
}
