/**
 * Where the MathSmart API lives, when nothing says otherwise.
 *
 * In local development `NEXT_PUBLIC_API_BASE_URL` names the API that
 * `npm run dev` starts on port 8000, and every service keeps validating that
 * configured value exactly as it always has. This module answers only the
 * question for when it is not set, which is the Vercel deployment: there the
 * API is a Python function on the same deployment, under `/api/v1`.
 *
 * - In the browser that is simply the relative path `/api/v1`: same origin,
 *   no CORS, no second domain.
 * - On the server, use Vercel's public project hostname in Production so
 *   reads can reach the API through Deployment Protection's public alias.
 *   Preview uses the deployment's own hostname. Both are platform settings.
 * - With neither, the answer is `null`, and each service reports "not
 *   configured" rather than guessing an address.
 */

export const SAME_ORIGIN_API_PATH = "/api/v1";

/** A bare DNS hostname: labels of letters, digits and hyphens. No port, path or scheme. */
const HOSTNAME = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

/** Vercel's generated hostname for the current deployment. */
export function trustedDeploymentHost() {
  const host = typeof process !== "undefined" ? process.env.VERCEL_URL : undefined;
  return typeof host === "string" && HOSTNAME.test(host) ? host.toLowerCase() : null;
}

/** Vercel's public project hostname when running in Production. */
export function trustedProductionHost() {
  if (typeof process === "undefined" || process.env.VERCEL_ENV !== "production") return null;
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return typeof host === "string" && HOSTNAME.test(host) ? host.toLowerCase() : null;
}

/**
 * The API address to use when no API URL is configured.
 *
 * @returns {string|null}
 */
export function sameOriginApiBaseUrl() {
  if (typeof window !== "undefined") return SAME_ORIGIN_API_PATH;
  const host = trustedProductionHost() ?? trustedDeploymentHost();
  return host ? `https://${host}${SAME_ORIGIN_API_PATH}` : null;
}

/**
 * A configured value through the caller's own validator, or the same-origin
 * address when nothing is configured.
 *
 * @param {string|undefined} configured - `process.env.NEXT_PUBLIC_API_BASE_URL`, passed by the caller so Next inlines it
 * @param {(value: string) => string|null} validate - The caller's existing rule for a configured value
 * @returns {string|null}
 */
export function apiBaseUrlFrom(configured, validate) {
  const value = typeof configured === "string" ? configured.trim() : "";
  return value ? validate(value) : sameOriginApiBaseUrl();
}

/** Trailing slashes off a configured value, the rule most services used. */
export function trimmedBaseUrl(value) {
  const trimmed = value.replace(/\/+$/, "");
  return trimmed || null;
}
