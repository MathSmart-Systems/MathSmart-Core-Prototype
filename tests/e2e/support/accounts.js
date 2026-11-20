export const STUDENT_ACCOUNT = Object.freeze({
  email: process.env.E2E_STUDENT_EMAIL,
  password: process.env.E2E_STUDENT_PASSWORD,
  home: "**/student/dashboard",
});

export const TEACHER_ADMIN_ACCOUNT = Object.freeze({
  email: process.env.E2E_TEACHER_ADMIN_EMAIL || process.env.LOCAL_TEACHER_ADMIN_EMAIL,
  password: process.env.E2E_TEACHER_ADMIN_PASSWORD || process.env.LOCAL_TEACHER_ADMIN_PASSWORD,
  home: "**/teacher/dashboard",
});

export function hasAccount(account = TEACHER_ADMIN_ACCOUNT) {
  return Boolean(account.email && account.password);
}

export async function signIn(page, account = TEACHER_ADMIN_ACCOUNT) {
  await page.goto("/login");
  await page.locator("form[data-hydrated=true]").waitFor();
  await page.getByLabel("Email address").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(account.home);
}
