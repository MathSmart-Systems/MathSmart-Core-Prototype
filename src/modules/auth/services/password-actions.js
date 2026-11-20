"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AUTH_NOTICE, loginPathWithNotice } from "@/lib/auth/notices";
import { isSupabaseConfigured } from "@/lib/supabase/config";

import { AUTH_MESSAGES } from "../messages";
import { PASSWORD_CONFIRM_PATH, PASSWORD_LINK_ERROR_PATH, PASSWORD_MIN_LENGTH } from "../password-setup";
import { clearRecoverySession, createRecoveryClient, getRecoveryUser } from "./password-recovery";

export async function requestPasswordLink(_previousState, formData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: AUTH_MESSAGES.missingEmail };
  if (!isSupabaseConfigured()) return { error: AUTH_MESSAGES.configuration };

  try {
    const origin = (await headers()).get("origin");
    if (!origin) return { error: AUTH_MESSAGES.service };

    const redirectTo = new URL(PASSWORD_CONFIRM_PATH, origin).href;
    const supabase = await createRecoveryClient();

    // The response stays the same whether Auth found the account or sent mail.
    await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    return { requested: true };
  } catch {
    return { error: AUTH_MESSAGES.service };
  }
}

export async function choosePassword(expectedUserId, _previousState, formData) {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  if (password.length < PASSWORD_MIN_LENGTH) return { error: "Use at least 8 characters." };
  if (Buffer.byteLength(password, "utf8") > 72) return { error: "Choose a shorter password." };
  if (password !== confirmation) return { error: "The passwords do not match. Enter the same password in both fields." };
  if (!isSupabaseConfigured()) return { error: AUTH_MESSAGES.configuration };

  let destination = PASSWORD_LINK_ERROR_PATH;
  try {
    const supabase = await createRecoveryClient();
    const user = await getRecoveryUser(supabase);
    if (user && user.id === expectedUserId) {
      const { error } = await supabase.auth.updateUser({ password });
      if (error?.code === "weak_password") return { error: "Choose a stronger password and try again." };
      if (error?.code === "same_password") return { error: "Choose a password you have not used for this account before." };
      if (error) return { error: AUTH_MESSAGES.service };

      // Clear the browser's recovery session even if remote sign-out fails.
      await supabase.auth.signOut({ scope: "local" }).catch(() => null);
      await clearRecoverySession();
      destination = loginPathWithNotice(AUTH_NOTICE.PASSWORD_SET);
    }
  } catch {
    return { error: AUTH_MESSAGES.service };
  }

  redirect(destination);
}
