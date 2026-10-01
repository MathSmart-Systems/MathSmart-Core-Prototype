/**
 * Browser calls for the Teacher/Administrator Settings screen.
 *
 * Two documented endpoints and nothing else: `GET /teacher-admin/settings` for
 * the effective configuration, and `PATCH /teacher-admin/settings` for the one
 * key this screen is allowed to change. The credential and the model are
 * `.env` values the API never returns and this module never sends.
 *
 * The transport is deliberately small and private to the feature, in line with
 * the module-ownership rules. The interventions and assessments modules each
 * carry a fuller copy of the same reply shape — `{ok, status, data, error,
 * code}` — which is now a genuine candidate for promotion to
 * `src/modules/shared/`; that promotion is a separate, coordinated change.
 */

import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { secureApiBaseUrl } from "@/modules/shared/utils/api-url";

import { apiBaseUrlFrom } from "../../../../lib/api/base-url.js";

const REQUEST_TIMEOUT_MS = 10_000;

/** The setting this screen owns. The API refuses every other key anyway. */
export const ADVISORY_SETTING_KEY = "features.gemini_advisory";

function apiBaseUrl() {
  return apiBaseUrlFrom(process.env.NEXT_PUBLIC_API_BASE_URL, secureApiBaseUrl);
}

async function accessToken() {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.getSession();
    return error ? null : (data?.session?.access_token ?? null);
  } catch {
    return null;
  }
}

function failure(code, error, status = null) {
  return { ok: false, status, data: null, error, code };
}

async function request(path, { method = "GET", body = null } = {}) {
  const base = apiBaseUrl();
  if (!base) {
    return failure("api_unconfigured", "The MathSmart API address is not configured.");
  }

  const token = await accessToken();
  if (!token) {
    return failure("no_session", "Your session has ended. Sign in again to continue.");
  }

  const headers = { Accept: "application/json", Authorization: `Bearer ${token}` };
  if (body !== null) headers["Content-Type"] = "application/json";

  let response;
  try {
    response = await fetch(`${base.replace(/\/+$/, "")}${path}`, {
      method,
      headers,
      body: body !== null ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (caught) {
    const timedOut = caught?.name === "TimeoutError" || caught?.name === "AbortError";
    return failure(
      timedOut ? "request_timeout" : "network_error",
      "MathSmart could not reach the server. Check your connection and try again.",
    );
  }

  let parsed = null;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      data: null,
      error: parsed?.error?.message ?? `The request failed with status ${response.status}.`,
      code: parsed?.error?.code ?? null,
    };
  }

  return { ok: true, status: response.status, data: parsed?.data ?? null, error: null, code: null };
}

/**
 * Reads the effective configuration as the signed-in teacher sees it.
 *
 * @returns {Promise<{ok: boolean, status: number|null, data: object|null, error: string|null, code: string|null}>}
 */
export function fetchSettings() {
  return request("/teacher-admin/settings");
}

/**
 * Turns advisory AI support on or off for the whole school.
 *
 * The reply says which keys changed, not what the configuration now is, so a
 * caller that needs the new state reads it back.
 *
 * @param {boolean} enabled
 */
export function saveAdvisoryEnabled(enabled) {
  return request("/teacher-admin/settings", {
    method: "PATCH",
    body: { settings: { [ADVISORY_SETTING_KEY]: Boolean(enabled) } },
  });
}
