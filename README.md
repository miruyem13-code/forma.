# Forma — connected course marketplace

React/Vite frontend connected to the existing Express/Prisma/PostgreSQL backend from `dars-backend.zip`. Backend source: `integrations/dars-backend`. Real API mode is the default.

## Run

Use Node 22.12+ (Node 24 recommended):

```powershell
npm.cmd install
npm.cmd --prefix integrations/dars-backend ci
npm.cmd --prefix integrations/dars-backend run db:generate
npm.cmd --prefix integrations/dars-backend run db:migrate
npm.cmd run dev:all
```

Open **http://127.0.0.1:5173**. The extracted API runs on **5001**, with Vite forwarding `/api`. The original backend on 5000 is preserved. PostgreSQL must be running; the supplied configuration connects to the existing database on 54329. Do not start a second database on an occupied port.

For another machine, configure PostgreSQL using the backend README and `.env.example` before migrating. Do not overwrite existing `.env` secrets. The imported `.local` snapshot is preserved but has an incomplete WAL checkpoint and cannot be started as a database. The working local database is in `C:\Users\lenovo\Desktop\dars-backend\backend\.local\postgres`; it was recovered normally and is used by this integration. Do not reset or replace it with the ZIP snapshot. If PostgreSQL is stopped, run `npm.cmd --prefix C:\Users\lenovo\Desktop\dars-backend run db:local` in a separate terminal before `npm run dev:all`.

Frontend `.env`:

```dotenv
VITE_API_URL=/api/v1
VITE_USE_MOCKS=false
```

Backend local settings: `PORT=5001`, `FRONTEND_URL=http://localhost:5173,http://127.0.0.1:5173`. Existing database/session secrets are preserved. Environment and database files are Git-ignored.

Register a learner at `/register`; existing accounts remain available. Use `npm.cmd --prefix integrations/dars-backend run admin:create` to create an administrator. No default production passwords are supplied.

## Connected features

- Catalog, categories, course details, reviews and UZS prices.
- Registration/login/logout, cookie sessions, CSRF protection, profile/password updates.
- Persistent cart with server-calculated totals, orders and enrollments.
- Enrolled lessons, configured private video playback and saved progress.
- Admin metrics/orders, user roles, category CRUD and review moderation.
- Course metadata and full curriculum saved in one transaction. Existing lesson IDs retain progress. Archiving preserves purchases; explicitly deleting lessons removes their progress.

Course thumbnails accept HTTPS URLs. Lesson video fields accept private asset IDs; actual assets and a video provider must be configured. Payment checkout remains disabled until a real provider is integrated. No paid enrollment or payment success is simulated. Email reset/verification, avatar-upload UI and certificate-document UI remain outside the current frontend integration; backend avatar/certificate endpoints are available.

## Checks

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd run test:e2e
npm.cmd --prefix integrations/dars-backend run check
npm.cmd --prefix integrations/dars-backend test
npm.cmd run backend:test
```

Frontend tests cover demo workflows and intercepted API responses, including cookies and CSRF rotation. Backend integration tests use an isolated temporary PostgreSQL database and include Chrome → Vite → Express → PostgreSQL registration/profile/cart checks plus atomic curriculum/progress checks. Chrome must be installed. Stop development frontend servers before frontend tests (5173/5174); live integration tests use 5176. No existing database is reset by these tests.

## Demo mode

Set `VITE_USE_MOCKS=true` and restart to enable visibly labeled browser-local demo accounts. Passwords are not stored or verified in demo mode. Set it back to `false` for real accounts.

## Production

Build with `npm run build`; serve SPA routes through `index.html` and reverse proxy `/api` to the backend. Vite's development proxy is not part of `dist`. Configure HTTPS cookies, origins, database and providers before deployment. No public deployment was performed.

See [integration contract](docs/API-CONTRACT.md) and [backend API documentation](integrations/dars-backend/backend/docs/api.md).
