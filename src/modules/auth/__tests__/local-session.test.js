import assert from "node:assert/strict";
import test from "node:test";

import { isApprovedLocalSupabaseUrl, localTeacherCredentials } from "../../../lib/auth/local-session.js";

test("permits automatic sign-in only for the expected local Supabase URL", () => {
  assert.equal(isApprovedLocalSupabaseUrl("http://127.0.0.1:54321"), true);
  assert.equal(isApprovedLocalSupabaseUrl("https://example.supabase.co"), false);
  assert.equal(isApprovedLocalSupabaseUrl("http://127.0.0.1:54322"), false);
});

test("returns no automatic credential pair when local configuration is incomplete", () => {
  assert.equal(localTeacherCredentials({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" }), null);
});
