/**
 * The retained workspace uses the localhost-only automatic teacher session.
 * The browser suite never reads or types the credential; it only runs when
 * the local teacher configuration is present.
 */
export const TEACHER_ADMIN_ACCOUNT = Object.freeze({});

export function hasAccount() {
  return Boolean(process.env.LOCAL_TEACHER_ADMIN_EMAIL && process.env.LOCAL_TEACHER_ADMIN_PASSWORD);
}

export async function signIn(page) {
  await page.goto("/");
  await page.waitForURL("**/teacher/students");
}
