/**
 * Where the API is, with and without a configured address.
 *
 * Locally the configured address is used and validated as before. On Vercel
 * nothing is configured: the browser uses the same-origin path, and the server
 * uses the deployment's own `VERCEL_URL`, never an address a request supplies.
 */

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  SAME_ORIGIN_API_PATH,
  apiBaseUrlFrom,
  sameOriginApiBaseUrl,
  trimmedBaseUrl,
  trustedDeploymentHost,
} from "../../../lib/api/base-url.js";
import { secureApiBaseUrl } from "../utils/api-url.js";

const vercelKeys = ["VERCEL_URL", "VERCEL_ENV", "VERCEL_PROJECT_PRODUCTION_URL"];
const originalVercelEnv = Object.fromEntries(vercelKeys.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of vercelKeys) {
    if (originalVercelEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalVercelEnv[key];
  }
  delete globalThis.window;
});

describe("the API address", () => {
  it("uses a configured address, through the caller's own rule", () => {
    assert.equal(apiBaseUrlFrom(" http://127.0.0.1:8000/api/v1/ ", trimmedBaseUrl), "http://127.0.0.1:8000/api/v1");
    assert.equal(apiBaseUrlFrom("https://evil.example/api/v1", secureApiBaseUrl), null);
  });

  it("in the browser, with nothing configured, is the same-origin path", () => {
    globalThis.window = {};
    assert.equal(apiBaseUrlFrom(undefined, trimmedBaseUrl), SAME_ORIGIN_API_PATH);
    assert.equal(apiBaseUrlFrom("", secureApiBaseUrl), "/api/v1");
  });

  it("on the server, is the current deployment and nothing else", () => {
    process.env.VERCEL_URL = "mathsmart-git-main-team.vercel.app";
    assert.equal(sameOriginApiBaseUrl(), "https://mathsmart-git-main-team.vercel.app/api/v1");
  });

  it("uses the public production hostname for server reads and keeps previews on their own host", () => {
    process.env.VERCEL_URL = "mathsmart-abc.vercel.app";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "mathsmart.vercel.app";
    process.env.VERCEL_ENV = "production";
    assert.equal(sameOriginApiBaseUrl(), "https://mathsmart.vercel.app/api/v1");
    assert.equal(secureApiBaseUrl("https://mathsmart.vercel.app/api/v1"), "https://mathsmart.vercel.app/api/v1");

    process.env.VERCEL_ENV = "preview";
    assert.equal(sameOriginApiBaseUrl(), "https://mathsmart-abc.vercel.app/api/v1");

    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "mathsmart.vercel.app/path";
    assert.equal(sameOriginApiBaseUrl(), "https://mathsmart-abc.vercel.app/api/v1");
  });

  it("fails safe when there is no trusted deployment host", () => {
    delete process.env.VERCEL_URL;
    assert.equal(sameOriginApiBaseUrl(), null);
    for (const bad of ["evil.example/path", "evil.example:8080", "https://evil.example", "localhost", "a b.c"]) {
      process.env.VERCEL_URL = bad;
      assert.equal(trustedDeploymentHost(), null, bad);
      assert.equal(sameOriginApiBaseUrl(), null, bad);
    }
  });
});

describe("secureApiBaseUrl", () => {
  it("accepts the same-origin path", () => {
    assert.equal(secureApiBaseUrl("/api/v1"), "/api/v1");
    assert.equal(secureApiBaseUrl("/api/v1/"), "/api/v1");
    assert.equal(secureApiBaseUrl("/somewhere-else"), null);
  });

  it("accepts HTTPS only to an approved host or the current deployment", () => {
    process.env.VERCEL_URL = "mathsmart.vercel.app";
    assert.equal(secureApiBaseUrl("https://mathsmart.vercel.app/api/v1"), "https://mathsmart.vercel.app/api/v1");
    assert.equal(secureApiBaseUrl("https://api.mathsmart.test/api/v1"), "https://api.mathsmart.test/api/v1");
    assert.equal(secureApiBaseUrl("https://attacker.example/api/v1"), null);
    assert.equal(secureApiBaseUrl("http://mathsmart.vercel.app/api/v1"), null);
  });

  it("with no deployment, trusts no extra host", () => {
    delete process.env.VERCEL_URL;
    assert.equal(secureApiBaseUrl("https://mathsmart.vercel.app/api/v1"), null);
    assert.equal(secureApiBaseUrl("http://localhost:8000/api/v1"), "http://localhost:8000/api/v1");
  });
});
