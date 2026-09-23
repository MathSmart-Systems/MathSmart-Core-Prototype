const LOCAL_SUPABASE_URLS = new Set([
  "http://127.0.0.1:54321",
  "http://localhost:54321",
  "http://[::1]:54321",
]);

export function isApprovedLocalSupabaseUrl(value) {
  try {
    return LOCAL_SUPABASE_URLS.has(new URL(value).toString().replace(/\/$/, ""));
  } catch {
    return false;
  }
}

export function localTeacherCredentials(env = process.env) {
  if (!isApprovedLocalSupabaseUrl(env.NEXT_PUBLIC_SUPABASE_URL)) return null;

  const email = String(env.LOCAL_TEACHER_ADMIN_EMAIL ?? "").trim();
  const password = String(env.LOCAL_TEACHER_ADMIN_PASSWORD ?? "");
  return email && password ? { email, password } : null;
}
