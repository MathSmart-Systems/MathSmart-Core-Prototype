import { headers } from "next/headers";

import { isCurrentPreviewApi, previewApiRequestOptions } from "./base-url.js";

/** Authenticate server reads to this deployment while preserving the learner bearer token. */
export async function fetchServerApi(url, options) {
  if (!isCurrentPreviewApi(url)) return fetch(url, options);

  const token = (await headers()).get("x-vercel-oidc-token");
  return fetch(url, previewApiRequestOptions(url, options, token));
}
