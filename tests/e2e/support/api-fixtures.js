/** Returns a token for the locally configured teacher without printing credentials. */
export async function accessToken(request) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const response = await request.post(`${base}/auth/v1/token?grant_type=password`, {
    headers: { apikey: key, "Content-Type": "application/json" },
    data: {
      email: process.env.LOCAL_TEACHER_ADMIN_EMAIL,
      password: process.env.LOCAL_TEACHER_ADMIN_PASSWORD,
    },
  });

  if (!response.ok()) {
    throw new Error(`The local teacher session could not be created: ${response.status()}`);
  }

  return (await response.json()).access_token;
}

/** One authenticated call against the MathSmart API. */
export async function api(request, token, path, { method = "GET", data } = {}) {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;

  return request.fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    data,
  });
}
