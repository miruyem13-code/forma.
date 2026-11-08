# Online course marketplace REST API

This service runs independently of React. The database is PostgreSQL, with Prisma migrations and fixed-precision `NUMERIC(14,2)` UZS prices. All source and configuration are JavaScript ES modules; Prisma generates a JavaScript client. The backend separates routing, controllers, validation, services, and database repositories.

## Local setup without installed PostgreSQL

From the repository root, run `npm ci`, then `npm run local:setup`. The setup command uses native PostgreSQL binaries through the development dependency `embedded-postgres`; this is a real disk-backed PostgreSQL server, not an in-memory substitute. The cluster persists in `backend/.local/postgres`, listens only on `127.0.0.1:54329`, and uses random credentials stored in ignored local files. Setup creates `backend/.env` only if it does not already exist.

Run `npm run db:local` and leave it running. In another terminal run `npm start` (or `npm run dev` for reload). Create an operator account with `npm run admin:create`. Do not use the embedded development server for production.

On Windows PowerShell installations that block `npm.ps1`, use `npm.cmd` for these commands. npm 11 may require approval of package installation scripts; the root package records approvals for the installed native dependencies. Prisma generation is always explicit via `npm run db:generate`.

## Use an existing PostgreSQL server or Docker

1. Install dependencies from the repository root with `npm ci`.
2. Copy `backend/.env.example` to `backend/.env` and configure `DATABASE_URL` and `SESSION_SECRET`. Generate a secret using `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`.
3. Create a PostgreSQL database owned by your application operator. Alternatively run `docker compose -f backend/docker-compose.yml up -d`. The Compose credentials are development-only; it binds PostgreSQL to localhost.
4. Run `npm run db:generate`, then `npm run db:migrate`.
5. Optionally run `npm run db:seed`. It creates three realistic development courses with ordered lessons, no functioning login credentials, no administrator, no payments, and no enrollments. Seed is refused in production.
6. Run `npm run admin:create`, then `npm start`.

`npm run db:dev --workspace backend` creates future migrations during development. Commit the generated SQL. Use `db:migrate` to apply committed migrations in deployment; never use `db push` against production. Custom database check constraints and a partial unique index protecting pending orders are included in migrations.

## Administrator bootstrap

`npm run admin:create` prompts for full name, email, and a hidden, confirmed password. It requires an interactive terminal; credentials are never command-line arguments or hardcoded defaults. Passwords require 12–128 characters, uppercase, lowercase, and a digit. It refuses to run when an administrator already exists or when the email already belongs to an account. A transaction and shared advisory lock prevent simultaneous first-admin creation. Additional administrators are appointed through the authenticated role API. The final administrator cannot be demoted; role changes revoke the target's existing sessions.

## Configuration

Only variables used by the implementation are listed in `.env.example`.

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | `development`, `test`, or `production` |
| `PORT` | HTTP listen port; default 5000 |
| `DATABASE_URL` | PostgreSQL connection URL; optional `schema` and `connection_limit` parameters are parsed by the pg adapter |
| `FRONTEND_URL` | Comma-separated exact frontend origins; default `http://localhost:5173`; no paths or wildcard |
| `SESSION_SECRET` | At least 48 characters; use a randomly generated secret, shared by all instances |
| `COOKIE_DOMAIN` | Optional domain; blank creates host-only cookies |
| `COOKIE_SAME_SITE` | `lax`, `strict`, or `none` |
| `COOKIE_SECURE` | Must be `true` in production and with SameSite=None |
| `SESSION_TTL_HOURS` | Absolute session lifetime, default 168, maximum 720 |
| `TRUST_PROXY_HOPS` | Exact number of trusted proxy hops; default 0 |
| `LOG_LEVEL` | Pino log level, default info |
| `DEV_ENROLLMENT_ENABLED` | Explicit development/test admin-only enrollment flag; default false; production refuses true |
| `PAYMENT_PROVIDER` | Blank disables payments; `click`, `payme`, or `custom` requires a supplied adapter |
| `PAYMENT_WEBHOOK_SECRET` | Verification secret for configured payment adapter, minimum 32 characters |
| `PAYMENT_ADAPTER_MODULE` | Operator-controlled module path, relative to `backend/` or absolute |
| `STORAGE_PROVIDER` | `database` (default) or `custom` |
| `STORAGE_ADAPTER_MODULE` | Module exporting the configured storage adapter |
| `VIDEO_PROVIDER` | `disabled` (default), development-only `signed-local`, or `custom` |
| `VIDEO_ADAPTER_MODULE` | Module exporting the configured private video adapter |
| `MEDIA_LOCAL_DIR` | Local development MP4 directory; default `.local/media` |
| `TEST_DATABASE_URL` | Separate disposable test database; unset to start an isolated PostgreSQL server automatically |

Configuration is validated at startup. `.env` and `.local` are ignored by Git and Docker. Do not expose database or adapter credentials through frontend environment variables.

## React integration

Set `VITE_API_URL=http://localhost:5000/api/v1`. Every cookie request needs `credentials: 'include'`. Obtain a CSRF token before registration/login or any other mutation. Store the returned CSRF token in memory. Registration, login, and refresh return a replacement token; after logout or a password change obtain a new anonymous token before signing in again.

```js
const API = import.meta.env.VITE_API_URL;
let csrfToken;

export async function initCsrf() {
  const response = await fetch(`${API}/auth/csrf`, { credentials: 'include' });
  const result = await response.json();
  if (!response.ok) throw result.error;
  csrfToken = result.data.csrfToken;
}

export async function api(path, { method = 'GET', body, idempotencyKey } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (!['GET', 'HEAD'].includes(method)) headers['X-CSRF-Token'] = csrfToken;
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const response = await fetch(`${API}${path}`, {
    method, credentials: 'include', headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw result.error;
  if (result.data.csrfToken) csrfToken = result.data.csrfToken;
  return result.data;
}

await initCsrf();
// await api('/auth/login', { method: 'POST', body: { email, password } });
// Keep this key for retries of this specific checkout attempt:
// await api('/orders', { method: 'POST', body: {}, idempotencyKey: crypto.randomUUID() });
```

Browsers attach Origin automatically. CLI/API test clients must send an allowed `Origin` and `X-CSRF-Token` for mutations. FormData avatar requests use the same CSRF header but must not manually set Content-Type. Relative asset/media URLs are resolved against the backend origin, not the frontend origin. Display monetary strings without converting them to floats for calculations.

For same-site subdomains use HTTPS, Secure cookies, and normally SameSite=Lax. For truly cross-site frontend/API hosting use SameSite=None and Secure=true; browser third-party-cookie restrictions may still block this topology, so prefer a shared site or reverse proxy. No browser-readable session token is returned in JSON.

## Payments, uploads, video, and testing enrollment

Payments are disabled by default. Orders remain `PENDING_PAYMENT`; creation never grants enrollment, including zero-price orders. Click/Payme adapters must be supplied and tested against their current official sandbox protocols before enabling payment configuration. There is no production fake-payment endpoint. Provider contracts and reconciliation limits are in [providers.md](docs/providers.md).

Avatars work locally and in ordinary Node/serverless deployments without external storage using PostgreSQL bytea. Multer caps input at 2 MiB; Sharp decodes valid JPEG/PNG/WebP content, rejects unsupported/animated content, strips metadata, and resizes/re-encodes to WebP. The public asset endpoint serves avatars only. A custom persistent object-storage adapter can replace PostgreSQL storage.

Private video is disabled by default; lesson metadata is available to enrolled students and `playback` is null until a provider/asset exists. No public course response contains video identifiers. For local playback testing set `VIDEO_PROVIDER=signed-local`, put `example-asset.mp4` inside `MEDIA_LOCAL_DIR`, and set a lesson's `videoUrl` to `example-asset` through the admin API. The historical field name holds a private asset ID, never a raw URL. The local adapter returns a two-minute, session-bound signed route requiring authentication and enrollment; it is rejected in production. `isPreview` is metadata only and does not bypass enrollment.

For manual enrollment testing set `DEV_ENROLLMENT_ENABLED=true` in development, sign in as ADMIN, and POST `{ "userId": "UUID", "courseId": "UUID" }` to `/admin/dev/enrollments` with CSRF. The grant is tagged `DEVELOPMENT`, audited by actor/course/user IDs, and creates no payment or paid order. Production startup refuses this flag; the endpoint also checks environment at execution time.

## Verification

Run from the root:

```sh
npm run check
npm test
npm run test:integration
npm audit
```

Integration tests use Supertest against the real Express app and a separate PostgreSQL database. With no `TEST_DATABASE_URL`, the runner creates a random-password PostgreSQL cluster and removes it after testing. With an explicit URL, the database name must contain a separate `test` segment (for example `dars_test`), must differ from `DATABASE_URL`, and must be disposable: the suite truncates marketplace tables. It applies migrations before running tests. Do not point it at a database containing useful data. On platforms where native embedded binaries are unavailable, provision a dedicated PostgreSQL test database instead.

The tests cover authentication, session expiration/revocation/rotation, CSRF, roles, course and curriculum management, filters, carts, concurrent idempotent orders, disabled payment behavior, verified-event fulfillment via a test-only injected adapter, lesson access, progress, certificates, profile/password changes, avatar content validation, reviews, admin safety, and local signed media. No payment provider credentials or live external services are used by tests.

`npm run db:check --workspace backend` verifies connectivity and the migrated User table. Run `npm run sessions:prune --workspace backend` periodically to remove expired/revoked sessions and expired rate-limit counters.

## Deployment

Use a Node.js host with HTTPS termination and persistent PostgreSQL. Production startup requires HTTPS frontend origins and Secure cookies, refuses development enrollment/local video, and checks database connectivity. Set the exact proxy hop count to match the trusted ingress; the application rejects plaintext requests in production. Only expose the application through that ingress. All instances must share PostgreSQL, the session secret, and the same cookie/provider configuration.

Run `npm ci`, `npm run db:generate`, and `npm run db:migrate` as deployment preparation, then start with `npm start`. Keep Prisma CLI available in the release job when installing runtime dependencies with `--omit=dev`. Runtime connections use the pg pool with a default maximum of 10 per process. Set a lower `connection_limit` for many instances and use your host's PostgreSQL pooler where appropriate. Migrations need a connection supporting DDL; give the release job a direct database URL when the runtime uses a restricted pooler. TLS verification stays enabled; configure your PostgreSQL provider's CA rather than disabling certificate verification.

An optional container can be built from the repository root with `docker build -f backend/Dockerfile -t dars-api .`. It generates Prisma during build, removes development packages, and runs as the non-root node user. Run migrations separately before starting the runtime container. The container recipe is provided but is not a claim of a tested deployment.

The service handles SIGINT/SIGTERM, closes HTTP connections, and disconnects Prisma. Pino logs request IDs, paths without query strings, status, and structured safe audit fields. It never logs request bodies, cookies, session tokens, passwords, or webhook secrets. Helmet, exact-origin credentialed CORS, session-bound CSRF, shared PostgreSQL rate limits, ownership checks, strict Zod schemas, and database constraints are active.

Course deletion is archival, preserving previous purchases and learning access. Cancellation only applies to unpaid orders. Late successful payments for cancelled orders, refunds, chargebacks, provider disputes, email verification, and password recovery require explicit product/provider work before offering those flows; they are not silently simulated. No external hosting deployment or provider integration is claimed by this repository.
