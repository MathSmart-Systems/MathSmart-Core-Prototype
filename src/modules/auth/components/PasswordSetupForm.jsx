"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { AUTH_MESSAGES } from "../messages";
import { PASSWORD_MIN_LENGTH } from "../password-setup";
import { choosePassword, requestPasswordLink } from "../services/password-actions";

export function PasswordSetupForm({ userId, isConfigured, linkExpired }) {
  const choosing = Boolean(userId);
  const action = choosing ? choosePassword.bind(null, userId) : requestPasswordLink;
  const [state, formAction, pending] = useActionState(action, null);
  const error = state?.error ?? (!isConfigured
    ? AUTH_MESSAGES.configuration
    : linkExpired && !state?.requested
      ? "This link is invalid or expired. Request a new password link."
      : null);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {error ? (
        <p role="alert" className="border-l-[3px] border-destructive bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {state?.requested ? (
        <p role="status" className="border-l-[3px] border-primary bg-primary/5 px-4 py-3 text-sm text-foreground">
          If your school email has a MathSmart account, a password link will arrive in your inbox. Check your spam folder too.
        </p>
      ) : null}

      {choosing ? (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-password">New password</Label>
            <Input id="new-password" name="password" type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} aria-describedby="password-length" required className="h-11 bg-card" />
            <p id="password-length" className="text-sm text-muted-foreground">Use at least 8 characters.</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input id="confirm-password" name="confirmation" type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} required className="h-11 bg-card" />
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="school-email">Email address</Label>
          <Input id="school-email" name="email" type="email" autoComplete="email" required className="h-11 bg-card" />
        </div>
      )}

      <Button type="submit" disabled={pending || !isConfigured} className="h-11">
        {choosing
          ? (pending ? "Saving password…" : "Save password")
          : (pending ? "Requesting link…" : "Send password link")}
      </Button>
    </form>
  );
}
