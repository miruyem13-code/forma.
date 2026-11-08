import { test, expect } from "@playwright/test";

test("real API mode honors null sessions, cookie requests, updates, and session expiration", async ({
  page,
}) => {
  let loggedIn = false;
  let expired = false;
  let profile = {
    id: "real-1",
    fullName: "API Learner",
    email: "api@example.com",
    role: "USER",
    bio: "",
  };
  const writes = [];
  const unknown = [];
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/v1", "");
    let data;
    let status = 200;
    const headers = {};
    if (path === "/auth/csrf") data = { csrfToken: loggedIn ? 'rotated-csrf' : 'contract-csrf' };
    else if (path === "/auth/me") data = loggedIn ? profile : null;
    else if (path === "/auth/login") {
      writes.push({ path, body: request.postDataJSON() });
      loggedIn = true;
      expect(request.headers()['x-csrf-token']).toBe('contract-csrf');
      data = { user: profile, csrfToken: 'rotated-csrf' };
      headers["set-cookie"] =
        "forma_session=contract-test; HttpOnly; SameSite=Lax; Path=/";
    } else if (path === "/users/me" && request.method() === "PATCH") {
      expect(request.headers()['x-csrf-token']).toBe('rotated-csrf');
      writes.push({
        path,
        body: request.postDataJSON(),
        cookie: request.headers().cookie,
      });
      profile = { ...profile, ...request.postDataJSON() };
      data = profile;
    } else if (path === '/users/me') data = profile;
    else if (path === '/cart') data = { items: [], subtotal: '0', discountTotal: '0', total: '0', currency: 'UZS' };
    else if (path === "/enrollments/me" && expired) {
      status = 401;
      data = { message: "Session expired at the backend." };
    } else if (
      [
        "/enrollments/me",
        "/cart",
        "/courses",
        "/categories",
        "/orders/me",
      ].includes(path)
    )
      data = [];
    else if (path === "/auth/logout") {
      loggedIn = false;
      data = { ok: true };
    } else {
      unknown.push(path);
      status = 404;
      data = { message: "Unexpected endpoint" };
    }
    await route.fulfill({
      status,
      contentType: "application/json",
      headers,
      body: JSON.stringify(status >= 400 ? data : { data }),
    });
  });
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(page.locator(".demo-banner")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Student demo" })).toHaveCount(
    0,
  );
  await page
    .getByRole("textbox", { name: "Email address", exact: true })
    .fill("api@example.com");
  await page.getByLabel("Password", { exact: true }).fill("Test12345");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: "Keep growing, API." }),
  ).toBeVisible();
  await page.goto("/profile/edit");
  await page
    .getByRole("textbox", { name: "Full name", exact: true })
    .fill("Cookie Learner");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Your profile has been updated.")).toBeVisible();
  expect(writes[0]).toEqual({
    path: "/auth/login",
    body: { email: "api@example.com", password: "Test12345" },
  });
  expect(writes[1].cookie).toContain("forma_session=contract-test");
  expect(writes[1].body.fullName).toBe("Cookie Learner");
  expect(writes[1].body).not.toHaveProperty('email');
  expired = true;
  await page.goto("/my-learning");
  await expect(page).toHaveURL(/\/login\?next=/);
  expect(unknown).toEqual([]);
});

test("API errors show retry UI and do not fall back to sample data", async ({
  page,
}) => {
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/me"))
      return route.fulfill({ status: 401, json: { message: "Not signed in" } });
    if (path.endsWith("/categories")) return route.fulfill({ json: [] });
    return route.fulfill({
      status: 503,
      json: { message: "The catalog is temporarily unavailable." },
    });
  });
  await page.goto("/courses");
  await expect(
    page.getByText("The catalog is temporarily unavailable."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.locator(".course-card")).toHaveCount(0);
});
