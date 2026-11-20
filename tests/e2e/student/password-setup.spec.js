import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

import { hasAccount, signIn, TEACHER_ADMIN_ACCOUNT } from "../support/accounts";
import { isLocalDataEnvironment } from "../support/environment";
import { confirmationLink, localFixturesAvailable, localSql } from "../support/local-accounts";

test("password setup is reachable from sign-in and fits the auth layout", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Set or reset your password" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Set up your password" })).toBeVisible();
  await expect(page.getByLabel("Email address")).toHaveAttribute("type", "email");

  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("button", { name: "Send password link" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("an invalid recovery link returns to the email form on the same origin", async ({ baseURL, page }) => {
  await page.goto("/password-setup/confirm?code=invalid");
  expect(new URL(page.url()).origin).toBe(new URL(baseURL).origin);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Request a new password link");
  await expect(page.getByLabel("New password", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Email address")).toBeVisible();
});

test("a newly enrolled student sets a password and signs in", async ({ baseURL, browser, page }) => {
  test.skip(!isLocalDataEnvironment() || !localFixturesAvailable() || !hasAccount(),
    "Requires a seeded teacher and local Supabase with Mailpit");

  const suffix = randomUUID().slice(0, 8);
  const email = `password-setup-${suffix}@example.org`;
  const password = `Test-${randomUUID()}`;
  const name = `Learner ${suffix}`;
  const learnerPage = await browser.newPage({ baseURL });

  try {
    await signIn(page, TEACHER_ADMIN_ACCOUNT);
    await page.goto("/teacher/students");
    await page.getByRole("button", { name: "Enroll student", exact: true }).click();
    const enrollment = page.getByRole("dialog", { name: "Enroll Student" });
    await enrollment.getByLabel("Full Name").fill(name);
    await enrollment.getByLabel("Email", { exact: true }).fill(email);
    await enrollment.getByLabel("Learner ID / LRN").fill(`E2E-${suffix}`);
    await enrollment.getByRole("button", { name: "Save & Enroll" }).click();
    await expect(enrollment).toBeHidden();

    await learnerPage.goto("/login");
    await learnerPage.getByRole("link", { name: "Set or reset your password" }).click();
    await learnerPage.getByLabel("Email address").fill(email);
    await learnerPage.getByRole("button", { name: "Send password link" }).click();
    await expect(learnerPage.getByRole("status")).toContainText("a password link will arrive");
    await learnerPage.goto(await confirmationLink(email));
    await learnerPage.getByLabel("New password", { exact: true }).fill(password);
    await learnerPage.getByLabel("Confirm new password").fill(password);
    await learnerPage.getByRole("button", { name: "Save password" }).click();
    await expect(learnerPage.getByText("Your password is saved.", { exact: false })).toBeVisible();

    await signIn(learnerPage, { email, password, home: "**/student/dashboard" });
    await expect(learnerPage.getByText("No scores yet.", { exact: false })).toBeVisible();
    await learnerPage.goto("/teacher/students");
    await expect(learnerPage).toHaveURL(/\/student\/dashboard$/);
  } finally {
    await learnerPage.context().close();
    localSql(`delete from auth.users where email = '${email}';`);
  }
});
