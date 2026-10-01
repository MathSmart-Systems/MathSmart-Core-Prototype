/**
 * Server-side read for the Teacher/Administrator Settings screen.
 *
 * Runs only on the server, forwards the caller's own Supabase access token to
 * the MathSmart API, and never touches a secret key. The reply it returns is
 * whatever `GET /teacher-admin/settings` says, which by contract holds no
 * credential and no editable model.
 */

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

import { apiBaseUrlFrom, trimmedBaseUrl } from "../../../../lib/api/base-url.js";

const REQUEST_TIMEOUT_MS = 10_000;

function apiBaseUrl() {
  return apiBaseUrlFrom(process.env.NEXT_PUBLIC_API_BASE_URL, trimmedBaseUrl);
}

async function accessToken() {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getSession();
    return error ? null : (data?.session?.access_token ?? null);
  } catch {
    return null;
  }
}

/**
 * Reads the effective configuration for the first render.
 *
 * @returns {Promise<{settings: object|null, error?: "unconfigured"|"session"|"unavailable"}>}
 */
export async function readSettingsData() {
  const base = apiBaseUrl();
  if (!base) return { settings: null, error: "unconfigured" };

  const token = await accessToken();
  if (!token) return { settings: null, error: "session" };

  let response;
  try {
    response = await fetch(`${base}/teacher-admin/settings`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return { settings: null, error: "unavailable" };
  }

  if (!response.ok) return { settings: null, error: "unavailable" };

  try {
    const body = await response.json();
    return { settings: body?.data ?? null };
  } catch {
    return { settings: null, error: "unavailable" };
  }
}
