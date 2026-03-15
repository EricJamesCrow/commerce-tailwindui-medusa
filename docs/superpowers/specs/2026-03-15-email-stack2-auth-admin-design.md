# Stack 2: Core Auth & Admin Emails — Design Spec

> **Date:** 2026-03-15
> **Depends on:** Stack 1 (Foundation) — completed 2026-03-14
> **Pattern:** Subscriber-only (no workflows) — these emails don't require complex data fetching
> **Supersedes:** Template prop interfaces for `password-reset`, `invite-user`, and `welcome` in `docs/email-template-architecture.md`. The interfaces defined here reflect implementation reality; the architecture spec's versions were pre-implementation drafts.

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Subscriber vs workflow | Subscriber-only for all three | Workflows reserved for complex multi-step data fetching (e.g., order confirmation). These emails need at most a single service call. |
| Template data contract | Templates receive ready-to-render data | Same principle as pre-formatted money strings in Stack 1. Subscribers build URLs, resolve names. Templates are dumb renderers. |
| Invite subscriber file count | Single file, array event config | Medusa supports `event: ["invite.created", "invite.resent"]`. Avoids duplicate handler code. |
| Welcome email scope | Fires for all `customer.created` | Both self-service signups and admin-created customers. No origin detection — if they have an account, they should know. |
| Admin URL resolution | `configModule` | `config.admin.backendUrl` + `config.admin.path` is the canonical source. Avoids second source of truth from a separate env var. Automatically handles admin path prefix. |
| Storefront URL | `process.env.STOREFRONT_URL` | Already established in Stack 1 (order confirmation workflow). |
| `subject` prop | Passed in notification `data` bag only, NOT part of React component Props | `subject` is consumed by the Resend service's `send()` method for the email subject line. The React template never renders it. Matches Stack 1's `OrderConfirmation` pattern. |
| `storeName` resolution | `EmailBrandConfig.companyName` from `_config/email-config.ts` | Already available as a shared config constant from Stack 1. No additional service call needed. |

## Files to Create

### 1. Password Reset

**Subscriber:** `src/subscribers/password-reset.ts`

```typescript
// Event: "auth.password_reset"
// Payload: { entity_id: string, actor_type: string, token: string, metadata?: Record<string, unknown> }
//
// IMPORTANT: `entity_id` IS the email address (renamed from `email` after Medusa v2.0.7).
// Use it directly as the `to` field and as the `email` template prop.

// Subscriber logic:
// 1. Extract email from data.entity_id, token from data.token, actorType from data.actor_type
// 2. Resolve configModule for admin URL
// 3. Build reset URL based on actor_type:
//    - "customer" → ${STOREFRONT_URL}/reset-password?token=${token}&email=${email}
//    - "user"     → ${backendUrl}${adminPath}/reset-password?token=${token}&email=${email}
// 4. Resolve storeName from EmailBrandConfig.companyName (imported from _config/email-config)
// 5. createNotifications({
//      to: email,
//      channel: "email",
//      template: "password-reset",
//      data: {
//        subject: actorType === "customer" ? "Reset Your Password" : "Reset Your Admin Password",
//        resetUrl,
//        email,
//        actorType,
//      }
//    })
```

**Template:** `src/modules/resend/templates/password-reset.tsx`

Props interface:
```typescript
interface PasswordResetProps {
  resetUrl: string
  email: string
  actorType: "customer" | "user"
}
```

Note: `subject` is NOT in the props interface — it's consumed by `service.ts` for the email subject line, not rendered by the template.

Layout:
- Header (shared component)
- "Reset Your Password" heading
- Explanation text (varies by actorType):
  - customer: "Reset your store account password"
  - user: "Reset your admin password"
- "Reset Password" CTA button (shared component) → `resetUrl`
- Expiry warning: "This link expires in 15 minutes"
- Ignore notice: "If you didn't request this, you can safely ignore this email"
- Footer (shared component)

Components used: Header, Footer, Button, Text — no commerce components.

### 2. Admin User Invite

**Subscriber:** `src/subscribers/invite-created.ts`

```typescript
// Event: ["invite.created", "invite.resent"]
// Payload: { id: string }

// Subscriber logic:
// 1. Resolve Modules.USER → retrieveInvite(data.id) to get email + token
// 2. Resolve configModule for admin URL
// 3. Build invite URL: ${backendUrl}${adminPath}/invite?token=${token}
// 4. Resolve storeName from EmailBrandConfig.companyName
// 5. createNotifications({
//      to: invite.email,
//      channel: "email",
//      template: "invite-user",
//      data: {
//        subject: `You've been invited to join ${storeName}`,
//        inviteUrl,
//        storeName,
//      }
//    })
```

**Template:** `src/modules/resend/templates/invite-user.tsx`

Props interface:
```typescript
interface InviteUserProps {
  inviteUrl: string
  storeName: string
}
```

Layout:
- Header
- "You've Been Invited" heading
- "You've been invited to join {storeName} as an admin" body text
- "Accept Invite" CTA button → `inviteUrl`
- Expiry notice: "This invitation expires in 7 days"
- Footer

Components used: Header, Footer, Button, Text — no commerce components.

### 3. Customer Welcome

**Subscriber:** `src/subscribers/customer-created.ts`

```typescript
// Event: "customer.created"
// Payload: { id: string }

// Subscriber logic:
// 1. Resolve Modules.CUSTOMER → retrieveCustomer(data.id) to get email, first_name, last_name
// 2. Build customerName from first_name + last_name, or null if neither exists
// 3. Build shopUrl: STOREFRONT_URL
// 4. Build accountUrl: ${STOREFRONT_URL}/account
// 5. Resolve storeName from EmailBrandConfig.companyName
// 6. createNotifications({
//      to: customer.email,
//      channel: "email",
//      template: "welcome",
//      data: {
//        subject: `Welcome to ${storeName}`,
//        customerName,
//        shopUrl,
//        accountUrl,
//        storeName,
//      }
//    })
```

**Template:** `src/modules/resend/templates/welcome.tsx`

Props interface:
```typescript
interface WelcomeProps {
  customerName: string | null
  shopUrl: string
  accountUrl: string
  storeName: string
}
```

Layout:
- Header
- "Welcome to {storeName}" heading
- Personalized greeting: "Hi {customerName}," or "Hi there," if null
- Warm welcome paragraph
- 2-3 value prop bullets (placeholder copy — customize per store)
- "Start Shopping" primary CTA button → `shopUrl`
- "View Your Account" secondary link → `accountUrl`
- Footer

Components used: Header, Footer, Button, Text — no commerce components.

## Files to Modify

**`src/modules/resend/service.ts`** — Add three entries to the template map:
```typescript
this.templates = {
  "order-confirmation": OrderConfirmation,
  "password-reset": PasswordReset,       // new
  "invite-user": InviteUser,             // new
  "welcome": Welcome,                    // new
}
```

## Event Reference

| Email | Event(s) | Full Payload | Data Fetching |
|---|---|---|---|
| Password reset | `auth.password_reset` | `{ entity_id, actor_type, token, metadata? }` | None — all data in payload. `entity_id` is the email address. |
| Admin invite | `invite.created`, `invite.resent` | `{ id }` | `Modules.USER.retrieveInvite(id)` → email, token |
| Customer welcome | `customer.created` | `{ id }` | `Modules.CUSTOMER.retrieveCustomer(id)` → email, first_name, last_name |

## Gotchas & Edge Cases

1. **`entity_id` IS the email address.** Renamed from `email` after Medusa v2.0.7. The `generateResetPasswordTokenWorkflow` receives `entityId` (which is the email) and passes it through as `entity_id` in the event payload. Use `data.entity_id` directly as both the `to` field and `email` prop.

2. **Password reset token expires in 15 minutes.** The `generateResetPasswordTokenWorkflow` hardcodes `expiresIn: "15m"` when generating the JWT. Template copy must say "15 minutes", not "1 hour".

3. **`invite.resent` regenerates the token.** The `refreshInviteTokensWorkflow` creates a new token. Always fetch the invite record fresh via `retrieveInvite()` — never cache tokens from `invite.created`.

4. **`customer.created` fires from two workflows.** `createCustomerAccountWorkflow` (storefront signup) internally calls `createCustomersWorkflow.runAsStep()`, which emits the event. Admin-created customers also go through `createCustomersWorkflow`. The subscriber always sees `{ id: string }` regardless of origin. Welcome email fires for both — this is intentional.

5. **Customer may have no name.** Storefront signup may only collect email. Template greeting degrades to "Hi there,".

6. **Admin URL construction.** Use `configModule.admin.backendUrl` and `configModule.admin.path` — don't hardcode `/app`. The `backendUrl` defaults to `process.env.MEDUSA_BACKEND_URL || "/"`. When `backendUrl === "/"` (local dev without `MEDUSA_BACKEND_URL` set), fall back to `http://localhost:9000`. In production, `MEDUSA_BACKEND_URL` must be set for email links to work. **This fallback logic lives in the subscriber, not the template.** Templates receive a fully-formed `resetUrl` or `inviteUrl` — they never resolve URLs themselves.

7. **Error handling.** Each subscriber should wrap the notification call in try/catch with structured logging via `container.resolve("logger")`, matching the pattern in `order-placed.ts`.

8. **`storeName` comes from `EmailBrandConfig`.** Import `companyName` from `_config/email-config.ts` (already exists from Stack 1). No additional service call needed.

## Out of Scope

- Email template visual design (uses existing shared components from Stack 1)
- Workflow-based sending (decision: subscriber-only for Stack 2)
- Email verification flow (separate feature, not part of welcome email)
- Admin-specific welcome email styling (both actor types use the same base layout)
- Idempotency keys on `createNotifications` (can be added later if duplicate delivery becomes an issue)
