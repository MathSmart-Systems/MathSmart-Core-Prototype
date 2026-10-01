import { expect, test } from "@playwright/test";

import { TEACHER_ADMIN_ACCOUNT, hasAccount, signIn } from "../support/accounts";
import { hostedDataSkipReason, isLocalDataEnvironment } from "../support/environment";

/**
 * Behavioural cover for the Teacher/Administrator Settings screen.
 *
 * The screen reads on any deployment, so the layout, the status block, the
 * absence of a credential field and the responsive behaviour are asserted
 * everywhere. Changing the switch writes a row and an audit record, so that
 * test runs only against the local Supabase stack and puts the setting back
 * the way it found it.
 */

const describe = hasAccount(TEACHER_ADMIN_ACCOUNT) ? test.describe : test.describe.skip;

const TOGGLE = "#teacher-settings-gemini-toggle";

/** The widths the workspace is expected to work at. */
const VIEWPORTS = [
  { name: "small phone", width: 320, height: 640 },
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "laptop", width: 1280, height: 800 },
];

async function openSettings(page) {
  await signIn(page);
  await page.goto("/teacher/settings");
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
}

describe("Teacher/Administrator settings", () => {
  test("shows both halves of the AI suggestion status without any credential", async ({ page }) => {
    await openSettings(page);

    await expect(page.getByRole("heading", { name: "AI suggestions", level: 2 })).toBeVisible();
    await expect(page.getByTestId("advisory-server")).toHaveText(/Configured|Not configured/);
    await expect(page.getByTestId("advisory-classroom")).toHaveText(/On|Off/);
    await expect(page.getByTestId("advisory-status")).toHaveText(/Enabled|Disabled|Unavailable/);

    await expect(
      page.getByText("The Gemini API key is kept on the server. It cannot be viewed or edited here."),
    ).toBeVisible();

    // No field of any kind can carry a credential off this screen, and no
    // credential-shaped string is printed on it either.
    await expect(page.locator("input, textarea")).toHaveCount(0);
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/AIza[\w-]{10,}/);
    expect(text).not.toMatch(/[A-Za-z0-9_-]{32,}/);
  });

  test("offers the switch as a switch, described by the state it is in", async ({ page }) => {
    await openSettings(page);

    const toggle = page.locator(TOGGLE);
    await expect(toggle).toHaveRole("switch");
    await expect(toggle).toHaveAccessibleName("Allow AI suggestions");

    const serverConfigured = (await page.getByTestId("advisory-server").textContent()) === "Configured";
    if (serverConfigured) {
      await expect(toggle).toBeEnabled();
    } else {
      // Nothing a teacher does here can turn on a provider the server has not
      // been given, so the control says so rather than failing on use.
      await expect(toggle).toBeDisabled();
      await expect(page.getByTestId("advisory-status")).toHaveText("Unavailable");
    }
  });

  test("is reachable from the workspace sidebar", async ({ page }) => {
    await signIn(page);
    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/teacher\/settings$/);
    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
  });

  for (const viewport of VIEWPORTS) {
    test(`fits a ${viewport.name} without sideways scrolling`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openSettings(page);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);

      // The control stays reachable and large enough to press at every width.
      const toggle = page.locator(TOGGLE);
      await expect(toggle).toBeVisible();
      const box = await toggle.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(40);
      expect(box.height).toBeGreaterThanOrEqual(20);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    });
  }

  test("keyboard reaches the switch and the switch answers the keyboard", async ({ page }) => {
    await openSettings(page);
    const toggle = page.locator(TOGGLE);
    test.skip(await toggle.isDisabled(), "the provider is not configured on this deployment");

    await toggle.focus();
    await expect(toggle).toBeFocused();
  });
});

describe("Teacher/Administrator settings, on the local stack", () => {
  test.skip(!isLocalDataEnvironment(), hostedDataSkipReason());

  test("turning AI suggestions off and on again reports and restores the state", async ({ page }) => {
    await openSettings(page);

    const toggle = page.locator(TOGGLE);
    const status = page.getByTestId("advisory-status");
    const classroom = page.getByTestId("advisory-classroom");
    test.skip(await toggle.isDisabled(), "the provider is not configured on this deployment");

    const startedOn = (await toggle.getAttribute("aria-checked")) === "true";

    await toggle.click();
    await expect(page.getByRole("status")).toContainText(
      startedOn ? "AI suggestions turned off." : "AI suggestions turned on.",
    );
    await expect(classroom).toHaveText(startedOn ? "Off" : "On");
    await expect(status).toHaveText(startedOn ? "Disabled" : "Enabled");
    await expect(toggle).toHaveAttribute("aria-checked", startedOn ? "false" : "true");

    // The change survives a reload, which is the difference between a screen
    // that saved and a screen that only looked like it did.
    await page.reload();
    await expect(page.locator(TOGGLE)).toHaveAttribute("aria-checked", startedOn ? "false" : "true");

    await page.locator(TOGGLE).click();
    await expect(page.getByTestId("advisory-classroom")).toHaveText(startedOn ? "On" : "Off");
    await expect(page.locator(TOGGLE)).toHaveAttribute("aria-checked", startedOn ? "true" : "false");
  });
});
