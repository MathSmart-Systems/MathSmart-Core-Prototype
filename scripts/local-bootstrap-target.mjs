const LOCAL_SUPABASE_ORIGINS = new Set([
  "http://127.0.0.1:54321",
  "http://localhost:54321",
  "http://[::1]:54321",
]);

const LOCAL_API_ORIGINS = new Set([
  "http://127.0.0.1:8000/api/v1",
  "http://localhost:8000/api/v1",
  "http://[::1]:8000/api/v1",
]);

const REQUIRED_TEACHER_INPUTS = [
  "LOCAL_TEACHER_ADMIN_EMAIL",
  "LOCAL_TEACHER_ADMIN_PASSWORD",
  "LOCAL_TEACHER_ADMIN_FULL_NAME",
  "LOCAL_TEACHER_ADMIN_EMPLOYEE_ID",
  "LOCAL_TEACHER_ADMIN_SCHOOL_NAME",
  "LOCAL_TEACHER_ADMIN_DIVISION_NAME",
];

function normalisedUrl(value) {
  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function expected(value, allowed) {
  const target = normalisedUrl(value);
  return target !== null && allowed.has(target);
}

export function assertLocalBootstrapTargets(env) {
  const targets = [
    ["NEXT_PUBLIC_SUPABASE_URL", env.NEXT_PUBLIC_SUPABASE_URL, LOCAL_SUPABASE_ORIGINS],
    ["SUPABASE_URL", env.SUPABASE_URL, LOCAL_SUPABASE_ORIGINS],
    ["NEXT_PUBLIC_API_BASE_URL", env.NEXT_PUBLIC_API_BASE_URL, LOCAL_API_ORIGINS],
  ];

  const invalid = targets
    .filter(([, value, allowed]) => !expected(value, allowed))
    .map(([name]) => name);

  if (invalid.length > 0) {
    throw new Error(`Refusing local bootstrap: ${invalid.join(", ")} is not an approved local target.`);
  }
}

export function localBootstrapConfig(env) {
  assertLocalBootstrapTargets(env);

  const missing = REQUIRED_TEACHER_INPUTS.filter((name) => !String(env[name] ?? "").trim());
  if (missing.length > 0) {
    throw new Error(`Local bootstrap requires: ${missing.join(", ")}.`);
  }

  return Object.fromEntries(REQUIRED_TEACHER_INPUTS.map((name) => [name, String(env[name]).trim()]));
}
