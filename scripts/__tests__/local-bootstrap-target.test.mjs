import assert from "node:assert/strict";
import test from "node:test";

import {
  assertLocalBootstrapTargets,
  localBootstrapConfig,
} from "../local-bootstrap-target.mjs";

const base = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:8000/api/v1",
  LOCAL_TEACHER_ADMIN_EMAIL: "teacher@example.test",
  LOCAL_TEACHER_ADMIN_PASSWORD: "local-password",
  LOCAL_TEACHER_ADMIN_FULL_NAME: "Local Teacher",
  LOCAL_TEACHER_ADMIN_EMPLOYEE_ID: "LOCAL-001",
  LOCAL_TEACHER_ADMIN_SCHOOL_NAME: "Local Elementary School",
  LOCAL_TEACHER_ADMIN_DIVISION_NAME: "Local Division",
};

test("accepts only the expected local Supabase and API targets", () => {
  assert.doesNotThrow(() => assertLocalBootstrapTargets(base));
});

test("refuses a hosted target before bootstrap work can begin", () => {
  assert.throws(
    () => assertLocalBootstrapTargets({ ...base, SUPABASE_URL: "https://example.supabase.co" }),
    /Refusing local bootstrap/,
  );
});

test("refuses a loopback target on an unexpected port", () => {
  assert.throws(
    () => assertLocalBootstrapTargets({ ...base, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54322" }),
    /Refusing local bootstrap/,
  );
});

test("requires every teacher input without including its value in the error", () => {
  const env = { ...base, LOCAL_TEACHER_ADMIN_PASSWORD: "" };
  assert.throws(() => localBootstrapConfig(env), /LOCAL_TEACHER_ADMIN_PASSWORD/);
  assert.throws(() => localBootstrapConfig(env), (error) => !error.message.includes("local-password"));
});
