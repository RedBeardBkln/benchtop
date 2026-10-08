This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

## Outside users / required environment

Benchtop supports invitation-only outside users: people outside the original staff workspace get a
private **account**, pay a Stripe subscription and get every feature, with no visibility into any
other account's data (projects, formulations, ingredients and inventory, suppliers, equipment,
documents). Existing data belongs to one billing-exempt **legacy account** shared by current staff.

### How it works (short version)

- **Tenant = account.** `projects`, `formulations`, `ingredients`, `suppliers`, `equipment` and
  `audit_log` carry `account_id`; all other tables are scoped through their parent. Every API route
  and server page resolves the caller's account (`src/lib/auth/context.ts`) and scopes every query;
  ids arriving in bodies/params are verified as owned (`src/lib/tenancy.ts`). Missing/foreign ids
  return 404.
- **Deny by default.** A signed-in Supabase user with no `account_members` row gets 403 from every
  API and is redirected to `/no-account`. Public Supabase signups therefore cannot reach any data.
- **Access rule.** Billing-exempt account, or subscription status `active`, `trialing` or `past_due`.
  Anything else: pages redirect to `/settings/billing?reason=subscription_required`, data APIs
  return `402 {code: "subscription_required"}`. Settings, billing APIs and legal pages stay reachable.
- **Invitations.** A platform admin creates an invite at `/admin/invitations` and sends the one-time
  link themselves (no email provider). Only a SHA-256 hash of the token is stored. Redemption
  (`/invite/<token>`) creates a pre-confirmed login, a new account (owner), a profile and records
  acceptance of the Terms/Privacy versions.
- **Settings** (`/settings`): profile, account (name, email, password), billing, privacy and terms
  (data export as JSON, account deletion). Public pages: `/legal/terms`, `/legal/privacy`
  (draft text, needs legal review; see `src/lib/legal.ts` for the placeholders to fill in).

### Environment variables

See `.env.example` for the full template. Real values go in `.env.local` (git-ignored).

| Variable | Needed for | If missing |
| --- | --- | --- |
| `DATABASE_URL` | App database connection | App cannot query |
| `DIRECT_URL` | drizzle-kit migrations (falls back to `DATABASE_URL`) | Uses `DATABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Login / sessions | Login cannot work |
| `SUPABASE_SERVICE_ROLE_KEY` (server only, **never** `NEXT_PUBLIC_`) | Invite redemption, document storage, account deletion, `db:bootstrap` | Those operations return 503 (`signup_not_configured`, `storage_not_configured`, `admin_not_configured`); build and everything else unaffected |
| `NEXT_PUBLIC_APP_URL` | Invite links and Stripe return URLs | Request origin is used |
| `PLATFORM_ADMIN_EMAILS` | Who may create invitations (applied by `pnpm db:bootstrap --apply`) | Warning; no admins are created |
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID` | Checkout and Customer Portal | Billing endpoints return `503 {code: "billing_not_configured"}`; billing page shows a "not configured" notice; outside accounts without a subscription are **not** entitled (fails closed); the legacy account is unaffected |
| `STRIPE_WEBHOOK_SECRET` | `/api/stripe/webhook` signature verification | Webhook returns 503 |
| `BILLING_DEV_BYPASS` | Dev only: `true` lets outside accounts in without a subscription | Off. **Ignored when `NODE_ENV=production`** |
| `ANTHROPIC_API_KEY`, `USDA_FDC_API_KEY`, `BRAVE_SEARCH_API_KEY` | AI parsing / research, USDA and web lookups | Existing behaviour (routes return 503 or an error) |

`pnpm build` does not need any of the Stripe or service-role variables.

### Stripe setup

1. In the Stripe dashboard (use **test mode** until launch) create a Product with one recurring Price
   and copy its id (`price_...`) into `STRIPE_PRICE_ID`. Put the secret key in `STRIPE_SECRET_KEY`.
2. Add a webhook endpoint `https://<your-domain>/api/stripe/webhook` with the events
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted` and `invoice.payment_failed`. Put its signing secret in
   `STRIPE_WEBHOOK_SECRET`.
3. Enable the Customer Portal (Settings -> Billing -> Customer portal) so "Manage billing" works.
4. Local development: `stripe listen --forward-to localhost:3000/api/stripe/webhook` prints a
   `whsec_...` secret to use as `STRIPE_WEBHOOK_SECRET`. Test card: `4242 4242 4242 4242`.

### Supabase dashboard settings

- Storage bucket `ingredient-docs`: **private**, with no broad `authenticated`/`anon` policy on
  `storage.objects` (the app uses the service-role key for all document access).
- Authentication -> Providers -> Email: **disable "Allow new users to sign up"** (defense in depth).

### Deploy order (do these together, in a short window)

`account_id` is `NOT NULL` with no default and there is a deny-by-default membership check, so the
order matters:

1. Apply the Drizzle migration: `pnpm db:migrate` (`drizzle/0007_*.sql` creates the account tables,
   backfills every existing row into the legacy account, and only then sets `NOT NULL`). Do **not**
   use `db:push` for this; it would skip the backfill.
2. Run `supabase/migrations/004_outside_users_rls.sql` in the Supabase SQL editor (drops the
   permissive `authenticated_all` policies; RLS on, no policies).
3. Deploy the application code.
4. Attach existing staff to the legacy account with `pnpm db:bootstrap` (set `PLATFORM_ADMIN_EMAILS`
   first). It is **a dry run by default**: it prints which users would be added and changes nothing.
   Review the list (every user it names gets access to all legacy staff data), then re-run with
   `--apply`. Prefer `pnpm db:bootstrap --emails a@x.com,b@y.com --apply` so only named staff are
   attached; without `--emails` it considers every Supabase auth user without a membership, so
   disable public signups first. It is idempotent. Until it has run with `--apply`, existing staff
   get "no account" by design.

### Tests

`pnpm test` runs the vitest suite (pure logic plus static guards: every API route is gated, tenant
tables are always scoped, env vars are documented, the migration backfills before `NOT NULL`).
