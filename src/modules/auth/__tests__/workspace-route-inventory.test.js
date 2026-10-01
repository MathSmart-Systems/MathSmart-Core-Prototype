import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { LOGIN_PATH, ROLES, homePathForRole, workspaceForPath } from "../../../lib/auth/roles.js";

const retainedRoutes = [
  "src/app/(teacher-admin)/teacher/students/page.jsx",
  "src/app/(teacher-admin)/teacher/students/[studentId]/page.jsx",
  "src/app/(teacher-admin)/teacher/interventions/page.jsx",
  "src/app/(teacher-admin)/teacher/interventions/[interventionId]/page.jsx",
  "src/app/(teacher-admin)/teacher/settings/page.jsx",
];

const removedRoutes = [
  "src/app/(student)",
  "src/app/(teacher-admin)/teacher/dashboard",
  "src/app/(teacher-admin)/teacher/assessments",
  "src/app/(teacher-admin)/teacher/competencies",
  "src/app/(teacher-admin)/teacher/learning-modules",
  "src/app/(teacher-admin)/teacher/activities",
  "src/app/(teacher-admin)/teacher/question-bank",
  "src/app/(teacher-admin)/teacher/grades-sections",
  "src/app/(teacher-admin)/teacher/reports-analytics",
];

test("only the retained teacher workspace routes remain", () => {
  for (const route of retainedRoutes) {
    assert.equal(existsSync(route), true, `${route} must remain available`);
  }

  for (const route of removedRoutes) {
    assert.equal(existsSync(route), false, `${route} must be removed`);
  }
});

test("the removed student workspace is no longer a frontend destination", () => {
  assert.equal(workspaceForPath("/student/dashboard"), null);
  assert.equal(homePathForRole(ROLES.STUDENT), LOGIN_PATH);
});

test("the teacher barrel exports only surviving workspace code", () => {
  const barrel = readFileSync("src/modules/teacher-admin/index.js", "utf8");
  assert.equal(barrel.includes('"./assessments"'), false);
});
