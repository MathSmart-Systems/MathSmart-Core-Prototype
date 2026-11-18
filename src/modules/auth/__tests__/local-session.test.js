import assert from "node:assert/strict";
import test from "node:test";

import { isApprovedLocalSupabaseUrl, localTeacherCredentials, teacherSessionCredentials } from "../../../lib/auth/local-session.js";

test("permits automatic sign-in only for the expected local Supabase URL", () => {
  assert.equal(isApprovedLocalSupabaseUrl("http://127.0.0.1:54321"), true);
  assert.equal(isApprovedLocalSupabaseUrl("https://example.supabase.co"), false);
  assert.equal(isApprovedLocalSupabaseUrl("http://127.0.0.1:54322"), false);
});

test("returns no automatic credential pair when local configuration is incomplete", () => {
  assert.equal(localTeacherCredentials({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" }), null);
});

test("hosted automatic sign-in is scoped to the explicitly configured Supabase demo project", () => {
  const settings = {
    NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
    DEMO_SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst",
    DEMO_TEACHER_ADMIN_EMAIL: "demo@example.com",
    DEMO_TEACHER_ADMIN_PASSWORD: "example-password",
  };

  assert.deepEqual(teacherSessionCredentials(settings), {
    email: "demo@example.com",
    password: "example-password",
  });
  assert.equal(teacherSessionCredentials({ ...settings, DEMO_SUPABASE_PROJECT_REF: "" }), null);
  assert.equal(teacherSessionCredentials({ ...settings, DEMO_TEACHER_ADMIN_PASSWORD: "" }), null);
  assert.equal(teacherSessionCredentials({
    ...settings,
    NEXT_PUBLIC_SUPABASE_URL: "https://zzzzzzzzzzzzzzzzzzzz.supabase.co",
  }), null);
  assert.equal(teacherSessionCredentials({
    ...settings,
    NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
  }), null);
  assert.deepEqual(teacherSessionCredentials({
    ...settings,
    NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
    LOCAL_TEACHER_ADMIN_EMAIL: "local@example.com",
    LOCAL_TEACHER_ADMIN_PASSWORD: "local-password",
  }), { email: "local@example.com", password: "local-password" });
});
