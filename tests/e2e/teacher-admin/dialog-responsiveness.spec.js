import { expect, test } from "@playwright/test";

import { TEACHER_ADMIN_ACCOUNT, hasAccount, signIn } from "../support/accounts";
import {
  DIALOG_VIEWPORTS,
  expectDialogBehaviour,
  expectDialogFits,
} from "../support/dialogs";

/**
 * Responsive cover for the Teacher/Administrator dialogs.
 *
 * Every dialog here is built from the shared primitive in
 * `src/components/ui/dialog.jsx`, so these are really tests of that one file —
 * the module-specific part retained here is the Students enrollment form.
 */

const describe = hasAccount(TEACHER_ADMIN_ACCOUNT) ? test.describe : test.describe.skip;

/** Each case opens one dialog and says what it is there to prove. */
const DIALOGS = [
  {
    name: "an enrolment form (Students)",
    route: "/teacher/students",
    trigger: { role: "button", name: "Enroll student", exact: true },
    ready: { role: "heading", name: "Enroll Student" },
  },
];

/** Opens one of the cases above, or skips when the page cannot offer it. */
async function openDialog(page, entry) {
  await page.goto(entry.route);
  const trigger = page.getByRole(entry.trigger.role, {
    name: entry.trigger.name,
    // `exact` is meaningless against a pattern, and passing it with one is a
    // Playwright error rather than a no-op.
    ...(entry.trigger.exact === undefined ? {} : { exact: entry.trigger.exact }),
  }).first();

  await expect(trigger).toBeVisible();
  test.skip(await trigger.isDisabled(), `${entry.name} cannot be opened on this data`);

  // How wide the page is before the dialog exists, so the dialog is only
  // blamed for what it actually adds.
  const baselineScrollWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );

  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  return { trigger, baselineScrollWidth };
}

describe("teacher/administrator dialogs at every width", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, TEACHER_ADMIN_ACCOUNT);
    await page.waitForURL("**/teacher/students");
  });

  for (const entry of DIALOGS) {
    test(`${entry.name} fits every viewport`, async ({ page }) => {
      test.setTimeout(90_000);

      for (const viewport of DIALOG_VIEWPORTS) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        const { baselineScrollWidth } = await openDialog(page, entry);
        await expectDialogFits(page, viewport, { baselineScrollWidth });
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toBeHidden();
      }
    });

    test(`${entry.name} keeps its keyboard behaviour on a phone`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 });
      const { trigger } = await openDialog(page, entry);

      await expectDialogBehaviour(page, trigger);
    });
  }

});
