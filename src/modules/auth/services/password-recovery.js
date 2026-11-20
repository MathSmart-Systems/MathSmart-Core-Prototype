import { cookies } from "next/headers";

import { parseTrustedRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

import { PASSWORD_SETUP_PATH } from "../password-setup";

const RECOVERY_COOKIE = "mathsmart-password-recovery";

// Keep recovery separate from workspace sign-in, even in a shared browser.
export function createRecoveryClient() {
  return createClient({
    name: RECOVERY_COOKIE,
    path: PASSWORD_SETUP_PATH,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 15 * 60,
  });
}

export async function getRecoveryUser(supabase) {
  const { data, error } = await supabase.auth.getUser();
  return !error && parseTrustedRole(data?.user) ? data.user : null;
}

export async function clearRecoverySession() {
  const cookieStore = await cookies();
  for (const { name } of cookieStore.getAll()) {
    if (name === RECOVERY_COOKIE || name.startsWith(`${RECOVERY_COOKIE}.`)) {
      cookieStore.set(name, "", { path: PASSWORD_SETUP_PATH, maxAge: 0 });
    }
  }
}
