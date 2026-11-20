import { expect, test } from "@playwright/test";

import { STUDENT_ACCOUNT, hasAccount, signIn } from "../support/accounts";

test("a signed-out visitor is sent to the shared login from either workspace", async ({ page }) => {
  for (const path of ["/student/dashboard", "/teacher/students"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  }
});

test("student signs in, sees their progress, and cannot open the teacher workspace", async ({ page }) => {
  test.skip(!hasAccount(STUDENT_ACCOUNT), "Requires a seeded student account");
  await signIn(page, STUDENT_ACCOUNT);
  await expect(page.getByRole("heading", { name: "Competency progress" })).toBeVisible();

  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("heading", { name: "Competency progress" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }

  await page.goto("/teacher/students");
  await expect(page).toHaveURL(/\/student\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Competency progress" })).toBeVisible();
});
