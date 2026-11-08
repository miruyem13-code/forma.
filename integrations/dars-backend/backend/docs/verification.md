# Local verification — 2026-11-07

The verified flow is: a React-compatible HTTP client sends a request to Express, authorization/validation and domain services run, PostgreSQL persists or reads data, and the API returns the documented response.

| Boundary | Result | Evidence |
| --- | --- | --- |
| JavaScript and Prisma schema | Passed | `npm run check`: syntax checks and `prisma validate` succeeded |
| Unit behavior | Passed | `npm test`: 10 tests passed |
| API → PostgreSQL → response | Passed | `npm run test:integration`: 31 tests passed against isolated native PostgreSQL 18.6 |
| Migrations | Passed | Both committed migrations applied to empty test and persistent local databases |
| Persistent development database | Passed | `npm run local:setup` initialized disk-backed PostgreSQL, applied migrations, seeded 3 courses, wrote ignored random credentials |
| Server startup | Passed | `npm start` logged `API listening` on port 5000 |
| Database readiness | Passed | `db:check` verified connectivity and the migrated User table |
| Real HTTP contract | Passed | `node scripts/smoke.js` verified health, catalog, public metadata privacy, credentialed CORS, CSRF cookie, and anonymous admin rejection |
| Dependency advisory audit | Passed | `npm audit`: 0 reported vulnerabilities at verification time |
| Secret-file exclusion | Passed | `git check-ignore` confirmed `.env`, local DB credentials, and PostgreSQL data are ignored |
| React browser UI | Not applicable | Frontend is being built separately; fetch examples and request contract are documented |
| Click/Payme settlement | Not configured | Payments remain disabled; no credentials or real provider integration were supplied |
| External object/video providers | Not configured | Database avatars and development signed-media flows were tested; custom production adapters remain integration work |
| Hosted deployment / container runtime | Not tested | No deployment or Docker runtime success is claimed |

The integration runner uses a test-only injected payment adapter to exercise verified-event fulfillment, amount checks, concurrent delivery, and enrollment idempotency. It is not a real provider simulator exposed by the runnable application.

The installed PostgreSQL driver emits a query-concurrency deprecation warning during Prisma transaction work. Tests pass with the pinned dependency tree; monitor Prisma/pg compatibility before a future pg major upgrade. No application authentication, payment, or database secrets are included in test output.

Run `npm run smoke --workspace backend` while the initialized local database and API are running to repeat the standalone HTTP checks. The first administrator is intentionally not pre-created; the operator supplies credentials through `npm run admin:create`.
