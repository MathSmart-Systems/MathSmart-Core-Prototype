import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

import { parseTrustedRole, ROLES } from "@/lib/auth/roles";
import { localTeacherCredentials } from "@/lib/auth/local-session";
import { getSupabaseConfig, isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

function destinationFor(request) {
  const next = request.nextUrl.searchParams.get("next");
  return next?.startsWith("/teacher/") ? next : "/teacher/students";
}

/** Creates an ordinary Supabase cookie session only for the approved local stack. */
export async function GET(request) {
  const credentials = localTeacherCredentials();
  if (!credentials || !isSupabaseConfigured()) return new NextResponse(null, { status: 404 });

  const response = NextResponse.redirect(new URL(destinationFor(request), request.url));
  const { url, publicKey } = getSupabaseConfig();
  const supabase = createServerClient(url, publicKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
    },
  });

  const { error } = await supabase.auth.signInWithPassword(credentials);
  if (error) return new NextResponse(null, { status: 503 });

  const { data, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || parseTrustedRole(data?.claims) !== ROLES.TEACHER_ADMIN) {
    await supabase.auth.signOut({ scope: "local" });
    return new NextResponse(null, { status: 403 });
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
