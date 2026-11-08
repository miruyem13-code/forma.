import { test, expect } from "@playwright/test";

async function signIn(page, role = "student") {
  await page.goto("/login");
  await page
    .getByRole("button", {
      name: role === "admin" ? "Admin demo" : "Student demo",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(role === "admin" ? /\/admin$/ : /\/dashboard$/);
}

test("catalog search, cart deduplication, persistence, and honest checkout", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Make room for what’s next." }),
  ).toBeVisible();
  await expect(page.locator(".course-card")).toHaveCount(4);
  await page.screenshot({ path: ".preview/home-desktop.png", fullPage: true });
  await page
    .getByRole("textbox", { name: "What do you want to learn?" })
    .fill("Python");
  await page.getByRole("button", { name: "Find courses", exact: true }).click();
  await expect(page.locator(".course-card")).toHaveCount(1);
  await page
    .getByRole("button", {
      name: "Add Python for Data Analysis: A Practical Guide to cart",
    })
    .click();
  await expect(
    page.getByRole("link", { name: "Shopping cart, 1 courses" }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "View cart with Python for Data Analysis: A Practical Guide",
    })
    .click();
  await expect(page.locator(".cart-course")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".cart-course")).toHaveCount(1);
  await page.getByRole("button", { name: "Continue to checkout" }).click();
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByRole("button", { name: "Student demo", exact: true }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(
    page.getByRole("button", { name: "Payments unavailable" }),
  ).toBeDisabled();
  await expect(
    page.getByText(
      "You’re exploring a demo workspace. Checkout is unavailable, and no payment will be taken.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your next possibility is waiting." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("validated registration, persisted profile, enrollment boundary, and progress", async ({
  page,
}) => {
  await page.goto("/register");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByText("Enter your full name.")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Full name", exact: true })
    .fill("Test Learner");
  await page
    .getByRole("textbox", { name: "Email address", exact: true })
    .fill("learner@example.com");
  await page.getByLabel("Password", { exact: true }).fill("Sample123");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("Mismatch123");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByText("Your passwords don’t match.")).toBeVisible();
  await page.getByLabel("Confirm password", { exact: true }).fill("Sample123");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/learn/c2/c2-1");
  await expect(
    page.getByText("You must be enrolled to access this course."),
  ).toBeVisible();
  await page.goto("/learn/c1/c1-1");
  await expect(
    page.getByRole("heading", { name: "Welcome & your learning roadmap" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Mark complete", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Completed", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Completed", exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("Demo lesson notes.txt");
  await page.getByRole("button", { name: "Next lesson", exact: true }).click();
  await expect(page).toHaveURL(/\/learn\/c1\/c1-2$/);
  await page.goto("/profile/edit");
  await page
    .getByRole("textbox", { name: "Full name", exact: true })
    .fill("Updated Learner");
  await page
    .getByRole("textbox", { name: "Bio", exact: true })
    .fill("Learning something new every day.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Your profile has been updated.")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Full name", exact: true }),
  ).toHaveValue("Updated Learner");
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "This space is for administrators" }),
  ).toBeVisible();
});

test("admin creates, edits, publishes, and deletes a course with curriculum", async ({
  page,
}) => {
  await signIn(page, "admin");
  await expect(
    page.getByRole("heading", { name: "Revenue over time" }),
  ).toBeVisible();
  await page.screenshot({ path: ".preview/admin-desktop.png", fullPage: true });
  await page.goto("/admin/courses/new");
  await page
    .getByRole("textbox", { name: "Course title", exact: true })
    .fill("Practical Accessibility Fundamentals");
  await page
    .getByRole("textbox", { name: "URL slug", exact: true })
    .fill("practical-accessibility");
  await page
    .getByRole("textbox", { name: "Description", exact: true })
    .fill(
      "Learn to create accessible interfaces through practical projects and thoughtful testing techniques.",
    );
  await page
    .getByRole("textbox", { name: "What students will learn", exact: true })
    .fill("Build keyboard accessible forms\nUse semantic HTML correctly");
  await page
    .getByRole("textbox", { name: "Course requirements", exact: true })
    .fill("Basic knowledge of HTML");
  await page
    .getByRole("textbox", { name: "Full name", exact: true })
    .fill("Sam Teacher");
  await page
    .getByRole("textbox", { name: "Professional role", exact: true })
    .fill("Accessibility specialist");
  await page.getByRole("button", { name: "Add section", exact: true }).click();
  await page.getByRole("button", { name: "Add lesson", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Lesson title", exact: true })
    .fill("Meet your keyboard");
  await page.getByRole("button", { name: "Delete lesson Meet your keyboard", exact: true }).click();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/admin\/courses\/new$/);
  await expect(page.getByRole("textbox", { name: "Lesson title", exact: true })).toHaveValue("Meet your keyboard");
  await page
    .getByRole("button", { name: "Save draft", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/admin\/courses$/);
  const row = page
    .getByRole("row")
    .filter({ hasText: "Practical Accessibility Fundamentals" });
  await expect(row.getByText("Draft", { exact: true })).toBeVisible();
  await row
    .getByRole("button", {
      name: "Publish Practical Accessibility Fundamentals",
      exact: true,
    })
    .click();
  await expect(row.getByText("Published", { exact: true })).toBeVisible();
  await page.goto("/courses/practical-accessibility");
  await expect(
    page.getByRole("heading", {
      name: "Practical Accessibility Fundamentals",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Meet your keyboard", { exact: true }),
  ).toBeVisible();
  await page.goto("/admin/courses");
  await row
    .getByRole("button", {
      name: "Delete Practical Accessibility Fundamentals",
      exact: true,
    })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete course", exact: true })
    .click();
  await expect(row).toHaveCount(0);
});

test("all admin views render and dark mode persists", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn(page, "admin");
  for (const [path, heading] of [
    ["/admin/users", "Your learning community"],
    ["/admin/orders", "Orders"],
    ["/admin/categories", "Categories"],
    ["/admin/reviews", "Learner reviews"],
    ["/admin/analytics", "Analytics & insights"],
    ["/admin/settings", "Settings"],
    ["/admin/lessons", "Lessons & curriculum"],
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(errors).toEqual([]);
});

test("mobile navigation and key pages have no horizontal overflow", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [
    "/",
    "/courses",
    "/categories",
    "/courses/ui-ux-design-masterclass",
    "/login",
    "/register",
    "/help",
    "/missing-page",
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading").first()).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    if (path === "/") {
      for (const selector of [".hero h1", ".hero-search", ".hero-buttons"]) {
        const bounds = await page.locator(selector).boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
      }
      await page.screenshot({
        path: ".preview/home-mobile.png",
        fullPage: true,
      });
    }
  }
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await expect(page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Log in", exact: true })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: "Courses", exact: true })
    .click();
  await expect(page).toHaveURL(/\/courses$/);
  await page.goto("/");
  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 844 });
    const bounds = await page.locator(".hero h1").boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.screenshot({ path: ".preview/home-dark.png", fullPage: true });
  expect(errors).toEqual([]);
});
