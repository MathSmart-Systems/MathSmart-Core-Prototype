import { expect, test } from "@playwright/test";

import { hasAccount, signIn } from "../support/accounts";

test("teacher signs in, sees the class summary, and can open learner records", async ({ page }) => {
  test.skip(!hasAccount(), "Requires a seeded Teacher/Administrator account");
  await signIn(page);
  await expect(page.getByRole("region", { name: "Class summary" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Section" })).toBeEnabled();

  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("region", { name: "Class summary" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }

  await page.goto("/student/dashboard");
  await expect(page).toHaveURL(/\/teacher\/dashboard$/);
  await page.getByRole("link", { name: "All students" }).click();
  await expect(page).toHaveURL(/\/teacher\/students$/);

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login\?notice=signed-out$/);
  await page.goto("/teacher/dashboard");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
});
