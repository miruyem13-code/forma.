# API contract

Base: `/api/v1`. JSON success: `{ "success": true, "data": ... }`. JSON error: `{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Request validation failed", "details": [{ "path": "email", "message": "..." }] } }`. Binary avatars/media are the documented exceptions to JSON.

IDs are UUID strings. Timestamps are UTC ISO 8601 strings. Prices and totals are fixed two-decimal strings in **UZS**. Clients must send decimal strings for prices and never calculate authoritative totals. Unknown JSON properties are rejected. Text is stored as plain text; the frontend must render it as text, not unescaped HTML.

All mutations except verified provider webhooks require an exact allowed Origin, the HTTP-only CSRF nonce cookie, and `X-CSRF-Token`. Authentication uses an HTTP-only session cookie; there are no bearer JWTs. ADMIN routes additionally require the current database user role to be ADMIN.

Lists that support pagination accept `page` (default 1) and `limit` (default 20, max 100), and return `{ items: [], pagination: { page, limit, total, pages } }`. UUID path errors return 400. Missing/unowned orders return 404. Unauthenticated access returns 401; missing role/enrollment returns 403. Conflicts return 409. Rate limits return 429 with standard RateLimit headers. Disabled integrations return 503.

## Authentication and profile

| Method | Path | Access | Request / result |
| --- | --- | --- | --- |
| GET | `/health` | Public | Database-backed `{ status: "ok", database: "connected" }` |
| GET | `/auth/csrf` | Public | Sets nonce cookie; returns `{ csrfToken }`; no-store |
| POST | `/auth/register` | Public + CSRF | `{ fullName, email, password }`; 201 `{ user, csrfToken, expiresAt }` |
| POST | `/auth/login` | Public + CSRF | `{ email, password }`; same auth result, 200 |
| POST | `/auth/logout` | User | Empty body or `{}`; revokes current session and clears cookies |
| POST | `/auth/refresh` | User | `{}`; rotates current token and CSRF nonce, preserving absolute expiry |
| GET | `/auth/me` | User | Current safe user object |
| GET | `/users/me` | User | Same safe user object |
| PATCH | `/users/me` | User | At least one of `{ fullName, bio }`; bio may be null |
| PATCH | `/users/me/password` | User | `{ currentPassword, newPassword }`; revokes **all** sessions; sign in again |
| POST | `/users/me/avatar` | User | Multipart field `avatar`, max 2 MiB; returns updated user |
| GET | `/assets/:id` | Public | Re-encoded WebP avatar bytes; never lesson files |

User object: `{ id, fullName, email, avatarUrl, bio, role, createdAt, updatedAt }`. Registration always creates USER. `fullName` max 120; bio max 2000. Email is trimmed/lowercased. New passwords: 12–128 characters with uppercase, lowercase, and digit. Passwords/hashes/session hashes never appear in user JSON. Login/account/IP limits apply before expensive password verification.

## Courses and reviews

| Method | Path | Access | Request / result |
| --- | --- | --- | --- |
| GET | `/categories` | Public | Category array: `{ id, name, slug, description }` |
| GET | `/courses` | Public | Paginated published, non-archived course cards |
| GET | `/courses/:slug` | Public | Course card plus ordered `sections[].lessons[]` metadata |
| GET | `/courses/:courseId/reviews` | Public | Paginated visible reviews of a published course |
| POST | `/courses/:courseId/reviews` | Enrolled user | `{ rating: 1..5, comment }`; 201; one review per user/course |

Course query: `search` (max 100), `category` (slug), `sort=newest|price_asc|price_desc|popular`, `minPrice`, `maxPrice`, `discounted=true|false`, `page`, `limit`. Price filters and sorting use the effective price (`discountPrice` when present, otherwise `price`); popularity uses enrollment count. Course cards include public instructor fields only, category, prices, published state, timestamps, and `_count.enrollments`. Search is case-insensitive title/description matching. Public curriculum excludes `videoUrl` even for preview lessons. Review comments max 3000; ratings are also constrained in PostgreSQL.

## Cart, checkout, and payments

| Method | Path | Access | Request / result |
| --- | --- | --- | --- |
| GET | `/cart` | User | `{ items, subtotal, discountTotal, total, currency }`; removes unavailable/already-owned entries |
| POST | `/cart/items` | User | `{ courseId }`; 201; duplicate adds return the existing item |
| DELETE | `/cart/items/:courseId` | User | Idempotent `{ removed: true }` |
| POST | `/orders` | User | `{}` plus `Idempotency-Key` header; 201 new, 200 replay |
| GET | `/orders/me` | User | Paginated own orders |
| GET | `/orders/:id` | Owner | Own order and snapshots/payment summary |
| POST | `/orders/:id/cancel` | Owner | `{}`; cancel unpaid order, preserving snapshots |
| POST | `/orders/:id/checkout` | Owner | `{}`; configured provider checkout; 503 while disabled |
| POST | `/payments/webhook/:provider` | Verified provider | Exact raw body and provider verification headers; no browser CSRF |

Idempotency keys contain 16–100 letters, digits, underscores, or hyphens; `crypto.randomUUID()` is suitable. Reuse the same key when retrying a checkout request. Creating a new order with a different key while one is pending returns `PENDING_ORDER_EXISTS` and `error.details.orderId`; finish or cancel the existing order first. One pending order per user is also enforced by a partial unique database index. The cart is retained until verified payment; changes to the cart do not alter existing order snapshots. A cancelled key still replays its original cancelled order; use a new key for a fresh attempt.

Order: `{ id, userId, status, subtotal, discountTotal, total, currency, idempotencyKey, createdAt, updatedAt, items, payments }`. Creation adds `reused`. Items: `{ id, orderId, courseId, courseTitleSnapshot, priceSnapshot, discountSnapshot }`; discountSnapshot is the discount **amount**. States: `PENDING_PAYMENT`, `PAID`, `CANCELLED`. No client-supplied totals, statuses, or payment IDs are accepted at order creation. Zero-price orders also remain pending in the current contract. Verified matching UZS payments atomically create a Payment, set PAID, grant unique enrollments, and remove purchased cart entries. Repeated successful callbacks do not grant duplicates.

## Learning

| Method | Path | Access | Result / request |
| --- | --- | --- | --- |
| GET | `/enrollments/me` | User | Paginated enrollments and course cards |
| GET | `/enrollments/me/:courseId` | Enrolled user | `{ enrollment, course }`, including progress |
| GET | `/learning/courses/:courseId` | Enrolled user | Ordered sections, numbered lessons, individual progress, aggregate progress |
| GET | `/learning/courses/:courseId/lessons/:lessonId` | Enrolled user | Lesson metadata, progress, playback, previousLessonId, nextLessonId |
| PATCH | `/learning/lessons/:lessonId/progress` | Enrolled user | At least one of `{ completed: boolean, lastPositionSeconds: integer }` |
| POST | `/learning/courses/:courseId/certificate` | Enrolled user | `{}`; 201 certificate after all lessons complete; repeated calls return same certificate |
| GET | `/media/:lessonId?expires=...&signature=...` | Enrolled user | Development signed-local MP4 bytes, supports HTTP range requests |

Positions cannot exceed lesson duration. Setting completed=true records completedAt; false clears it. Aggregate progress: `{ completedLessons, totalLessons, percentage }`. Lesson playback: null if unavailable, otherwise adapter-generated `{ url, expiresAt, type }`. Local links expire in two minutes and are bound to user, session, lesson, and asset. Another enrolled user cannot reuse a copied local link. Full course access also remains available for archived purchases. Certificate includes UUID `certificateCode` and issuedAt; it records completion, not an independently verified accreditation.

## Administrator APIs

Every endpoint below is under `/admin` and requires ADMIN + authentication; mutations also require CSRF.

| Method | Path after `/admin` | Request / result |
| --- | --- | --- |
| GET | `/stats` | totalUsers, totalCourses, totalOrders, confirmedRevenue (paid orders only), currency, recentUsers, recentOrders, popularCourses |
| GET | `/courses` | Same filters/pagination as public catalog, includes unpublished non-archived courses |
| POST | `/courses` | Course input below; 201 |
| GET | `/courses/:id` | Full admin course, including private asset identifiers |
| PATCH | `/courses/:id` | Any nonempty subset of course input |
| DELETE | `/courses/:id` | Archives course and unpublishes it; retains purchases and curriculum |
| GET | `/courses/:courseId/sections` | Ordered section array |
| POST | `/courses/:courseId/sections` | `{ title }`; appends section, 201 |
| PATCH | `/courses/:courseId/sections/:id` | `{ title }` |
| DELETE | `/courses/:courseId/sections/:id` | Deletes section/lessons, compacts positions |
| PATCH | `/courses/:courseId/sections/reorder` | `{ ids: [every section UUID in desired order] }` |
| GET | `/sections/:sectionId/lessons` | Ordered admin lesson array |
| POST | `/sections/:sectionId/lessons` | Lesson input below; appends lesson, 201 |
| PATCH | `/sections/:sectionId/lessons/:id` | Nonempty subset of lesson input |
| DELETE | `/sections/:sectionId/lessons/:id` | Deletes lesson, compacts positions |
| PATCH | `/sections/:sectionId/lessons/reorder` | `{ ids: [every lesson UUID in desired order] }` |
| GET | `/users` | Paginated safe user objects |
| GET | `/users/:id` | Safe user object |
| PATCH | `/users/:id/role` | `{ role: "USER" | "ADMIN" }`; final-admin protection and session revocation |
| GET | `/orders` | Paginated all orders |
| GET | `/orders/:id` | Order details |
| GET | `/categories` | Category array |
| POST | `/categories` | `{ name, slug, description? }`; 201 |
| PATCH | `/categories/:id` | Nonempty subset of category input |
| DELETE | `/categories/:id` | Refuses deletion if still referenced by a course |
| GET | `/reviews` | Paginated reviews including hidden reviews |
| PATCH | `/reviews/:id` | `{ hidden: boolean }` moderation |
| DELETE | `/reviews/:id` | Deletes moderated review |
| POST | `/dev/enrollments` | `{ userId, courseId }`; development flag required; 201; no payment created |

Course input: `{ title, slug, description, instructorId, categoryId, price, discountPrice?, thumbnailUrl?, published? }`. Slugs use lowercase letters/digits with hyphens. Title max 200, description max 50000; thumbnail is HTTPS or null. Discount must be nonnegative and less than price. Both referenced IDs must exist. Publication defaults false. All money inputs are decimal strings; no exponential notation. Category name max 120, description max 2000.

Lesson input: `{ title, description?, videoUrl?, durationSeconds?, isPreview? }`. Title max 200, description max 10000. `videoUrl` is null or a private asset ID matching `[A-Za-z0-9_-]+` up to 200 characters. Duration defaults 0 and is capped at 86400. isPreview defaults false. Position is assigned by the server; reordering requires exactly all child IDs, without duplicates or foreign-parent IDs. Numbering begins at 1. Deleting curriculum is destructive to its progress records; course archival is preferable when retiring sold content.
