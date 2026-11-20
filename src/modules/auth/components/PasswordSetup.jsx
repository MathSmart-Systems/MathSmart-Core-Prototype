import Link from "next/link";

import { Button } from "@/components/ui/button";
import { LOGIN_PATH } from "@/lib/auth/roles";
import { isSupabaseConfigured } from "@/lib/supabase/config";

import { PASSWORD_SETUP_PATH } from "../password-setup";
import { createRecoveryClient, getRecoveryUser } from "../services/password-recovery";
import { AuthLayout } from "./AuthLayout";
import { PasswordSetupForm } from "./PasswordSetupForm";

export async function PasswordSetup({ params }) {
  const isConfigured = isSupabaseConfigured();
  const choosing = params.step === "choose";
  let user = null;
  if (isConfigured && choosing) {
    try {
      user = await getRecoveryUser(await createRecoveryClient());
    } catch {
      // The request form gives the learner a way to start again.
    }
  }

  return (
    <AuthLayout
      title={user ? "Choose a new password" : "Set up your password"}
      description={user
        ? "Choose a password for your MathSmart account. You’ll use it the next time you sign in."
        : "Enter the email address your school used for enrollment. Open the emailed link in this same browser."}
    >
      <PasswordSetupForm
        key={user?.id ?? "request"}
        userId={user?.id}
        isConfigured={isConfigured}
        linkExpired={params.link === "expired" || (choosing && !user)}
      />
      <Button asChild variant="link" className="self-start px-0">
        <Link href={user ? PASSWORD_SETUP_PATH : LOGIN_PATH}>
          {user ? "Request a new password link" : "Back to sign in"}
        </Link>
      </Button>
    </AuthLayout>
  );
}
