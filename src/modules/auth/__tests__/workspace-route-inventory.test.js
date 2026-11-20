import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { ROLES, homePathForRole, workspaceForPath } from "../../../lib/auth/roles.js";

const retainedRoutes = [
  "src/app/(student)/student/dashboard/page.jsx",
  "src/app/(teacher-admin)/teacher/students/page.jsx",
  "src/app/(teacher-admin)/teacher/students/[studentId]/page.jsx",
  "src/app/(teacher-admin)/teacher/interventions/page.jsx",
  "src/app/(teacher-admin)/teacher/interventions/[interventionId]/page.jsx",
  "src/app/(teacher-admin)/teacher/settings/page.jsx",
];

const removedRoutes = [
  "src/app/(teacher-admin)/teacher/dashboard",
  "src/app/(teacher-admin)/teacher/assessments",
  "src/app/(teacher-admin)/teacher/competencies",
  "src/app/(teacher-admin)/teacher/learning-modules",
  "src/app/(teacher-admin)/teacher/activities",
  "src/app/(teacher-admin)/teacher/question-bank",
  "src/app/(teacher-admin)/teacher/grades-sections",
  "src/app/(teacher-admin)/teacher/reports-analytics",
];

test("only the scoped prototype workspace routes are present", () => {
  for (const route of retainedRoutes) {
    assert.equal(existsSync(route), true, `${route} must remain available`);
  }

  for (const route of removedRoutes) {
    assert.equal(existsSync(route), false, `${route} must be removed`);
  }
});

test("the student dashboard is protected and is the student landing page", () => {
  assert.equal(workspaceForPath("/student/dashboard"), ROLES.STUDENT);
  assert.equal(homePathForRole(ROLES.STUDENT), "/student/dashboard");
});

test("the teacher barrel exports only surviving workspace code", () => {
  const barrel = readFileSync("src/modules/teacher-admin/index.js", "utf8");
  assert.equal(barrel.includes('"./assessments"'), false);
});
