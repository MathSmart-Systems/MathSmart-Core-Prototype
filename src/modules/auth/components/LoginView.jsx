import { Info, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

import { messageForNotice } from "../messages";
import { PASSWORD_SETUP_PATH } from "../password-setup";
import { AuthLayout } from "./AuthLayout";
import { LoginForm } from "./LoginForm";

function Notice({ notice }) {
  const message = messageForNotice(notice);

  if (!message) {
    return null;
  }

  const isError = message.tone === "error";
  const Icon = isError ? TriangleAlert : Info;

  return (
    <p
      role="status"
      className={
        isError
          ? "flex items-start gap-2.5 border-l-[3px] border-destructive bg-destructive/5 px-4 py-3 text-sm text-destructive"
          : "flex items-start gap-2.5 border-l-[3px] border-primary bg-primary/5 px-4 py-3 text-sm text-foreground"
      }
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{message.text}</span>
    </p>
  );
}

export function LoginView({ notice, isConfigured }) {
  return (
    <AuthLayout
      title="Sign in"
      description="MathSmart supports Grade 6 mathematics for learners and their teachers. Use the account your school gave you."
    >
      <Notice notice={notice} />
      <LoginForm isConfigured={isConfigured} />
      <Button asChild variant="link" className="self-start px-0">
        <Link href={PASSWORD_SETUP_PATH}>Set or reset your password</Link>
      </Button>
    </AuthLayout>
  );
}
