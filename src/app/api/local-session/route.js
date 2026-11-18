import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

import { parseTrustedRole, ROLES } from "@/lib/auth/roles";
import { teacherSessionCredentials } from "@/lib/auth/local-session";
import { getSupabaseConfig, isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

function destinationFor(request) {
  const next = request.nextUrl.searchParams.get("next");
  const fallback = new URL("/teacher/students", request.url);
  if (!next?.startsWith("/teacher/")) return fallback;

  const destination = new URL(next, request.url);
  return destination.origin === fallback.origin && destination.pathname.startsWith("/teacher/")
    ? destination
    : fallback;
}

function sessionError(message, status) {
  return new NextResponse(message, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

/** Creates a Supabase session for the approved local stack or hosted demo. */
export async function GET(request) {
  const credentials = teacherSessionCredentials();
  if (!credentials || !isSupabaseConfigured()) {
    return sessionError("The MathSmart demo account is not configured.", 503);
  }

  const response = NextResponse.redirect(destinationFor(request));
  const { url, publicKey } = getSupabaseConfig();
  const supabase = createServerClient(url, publicKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
    },
  });

  const { error } = await supabase.auth.signInWithPassword(credentials);
  if (error) return sessionError("The MathSmart demo could not sign in. Try again shortly.", 503);

  const { data, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || parseTrustedRole(data?.claims) !== ROLES.TEACHER_ADMIN) {
    const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
    if (signOutError) console.warn("Could not revoke the rejected MathSmart demo session.");
    return sessionError("The MathSmart demo account cannot open the Teacher/Administrator workspace.", 403);
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
