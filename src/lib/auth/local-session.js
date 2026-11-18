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

function credentialPair(email, password) {
  const trimmedEmail = String(email ?? "").trim();
  const configuredPassword = String(password ?? "");
  return trimmedEmail && configuredPassword
    ? { email: trimmedEmail, password: configuredPassword }
    : null;
}

export function localTeacherCredentials(env = process.env) {
  if (!isApprovedLocalSupabaseUrl(env.NEXT_PUBLIC_SUPABASE_URL)) return null;

  return credentialPair(env.LOCAL_TEACHER_ADMIN_EMAIL, env.LOCAL_TEACHER_ADMIN_PASSWORD);
}

export function teacherSessionCredentials(env = process.env) {
  if (isApprovedLocalSupabaseUrl(env.NEXT_PUBLIC_SUPABASE_URL)) {
    return localTeacherCredentials(env);
  }

  const projectRef = env.DEMO_SUPABASE_PROJECT_REF;
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!/^[a-z0-9]{20}$/.test(projectRef ?? "") ||
      supabaseUrl !== `https://${projectRef}.supabase.co`) {
    return null;
  }

  return credentialPair(env.DEMO_TEACHER_ADMIN_EMAIL, env.DEMO_TEACHER_ADMIN_PASSWORD);
}
