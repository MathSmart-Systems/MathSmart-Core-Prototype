import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseConfig } from "./config";

/**
 * Supabase client for Server Components, Server Actions, and Route Handlers.
 * A new client is created per request because it carries that request's cookies.
 */
export async function createClient(cookieOptions) {
  const { url, publicKey } = getSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(url, publicKey, {
    cookieOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet, _headers) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            const maxAge = options.maxAge === 0 ? 0 : (cookieOptions?.maxAge ?? options.maxAge);
            cookieStore.set(name, value, { ...options, maxAge });
          });
        } catch {
          // Server Components cannot write cookies. The proxy refreshes the
          // session on every request, so this can be ignored.
        }
      },
    },
  });
}
