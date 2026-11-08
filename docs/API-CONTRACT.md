# Existing backend integration

Authoritative endpoints: [backend API documentation](../integrations/dars-backend/backend/docs/api.md).

`src/services/backend.js` adapts the supplied API; `src/services/api.js` selects it unless VITE_USE_MOCKS is exactly true. The Axios client sends cookies, obtains GET /auth/csrf before writes, and tracks rotated tokens. One stale-CSRF retry is permitted. HTTP 401 clears protected client state.

Success responses: `{success:true,data:...}`. Errors: `{success:false,error:{code,message,details}}`. Lists: `{items,pagination:{page,limit,total,pages}}`. The adapter retrieves pages in batches of 100. User fullName and USER/ADMIN map to frontend name/student/admin.

Real prices are UZS. Backend price is regular price; discountPrice is nullable effective price. Writes use decimal strings; cart totals are backend-authoritative.

Course create/update accepts level, instructorRole, outcomes, requirements and optional sections. Sections and lessons use UUIDs. Lessons include title, description, durationSeconds, isPreview and nullable private asset ID in videoUrl. The complete editor payload saves atomically with ownership checks; unchanged lesson IDs retain progress. Public curriculum never exposes private media IDs. Additive migration 20261107000200_frontend_metadata stores course metadata.

Profile updates send fullName/bio only. Password updates send currentPassword/newPassword and revoke sessions. Registration requires 12+ characters, uppercase, lowercase and a digit.

Development: frontend 5173, extracted API 5001, /api proxy. Production requires equivalent proxying or credentialed CORS configuration. Payment and video provider setup follow backend documentation.
