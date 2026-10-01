import test from "node:test";
import assert from "node:assert/strict";

import {
  ADVISORY_STATUS,
  ADVISORY_STATUS_TEXT,
  readAdvisoryStatus,
  readFailureMessage,
  saveFailureMessage,
  saveSuccessMessage,
  withClassroomSetting,
} from "../utils/settings-helpers.js";

test("readAdvisoryStatus keeps the server half and the classroom half apart", () => {
  const enabled = readAdvisoryStatus({
    gemini: {
      server: "configured",
      classroom_enabled: true,
      status: "enabled",
      model: "gemini-x",
    },
  });
  assert.deepEqual(enabled, {
    serverConfigured: true,
    classroomEnabled: true,
    status: ADVISORY_STATUS.ENABLED,
    model: "gemini-x",
  });

  const classroomOff = readAdvisoryStatus({
    gemini: { server: "configured", classroom_enabled: false, status: "disabled", model: "gemini-x" },
  });
  assert.equal(classroomOff.serverConfigured, true);
  assert.equal(classroomOff.classroomEnabled, false);
  assert.equal(classroomOff.status, ADVISORY_STATUS.DISABLED);

  const serverOff = readAdvisoryStatus({
    gemini: { server: "not_configured", classroom_enabled: true, status: "unavailable", model: null },
  });
  assert.equal(serverOff.serverConfigured, false);
  assert.equal(serverOff.status, ADVISORY_STATUS.UNAVAILABLE);
});

test("readAdvisoryStatus derives the status when the reply omits it", () => {
  const derivedEnabled = readAdvisoryStatus({
    gemini: { server: "configured", classroom_enabled: true },
  });
  assert.equal(derivedEnabled.status, ADVISORY_STATUS.ENABLED);

  const derivedDisabled = readAdvisoryStatus({
    gemini: { server: "configured", classroom_enabled: false },
  });
  assert.equal(derivedDisabled.status, ADVISORY_STATUS.DISABLED);

  const derivedUnavailable = readAdvisoryStatus({
    gemini: { server: "not_configured", classroom_enabled: true },
  });
  assert.equal(derivedUnavailable.status, ADVISORY_STATUS.UNAVAILABLE);
});

test("readAdvisoryStatus treats a missing or malformed reply as off, never as on", () => {
  for (const input of [null, undefined, {}, { gemini: null }, { gemini: { status: "???" } }]) {
    const state = readAdvisoryStatus(input);
    assert.equal(state.status, ADVISORY_STATUS.UNAVAILABLE);
    assert.equal(state.serverConfigured, false);
    assert.equal(state.classroomEnabled, false);
    assert.equal(state.model, null);
  }
});

test("readAdvisoryStatus hides the model unless the server is actually using one", () => {
  const blank = readAdvisoryStatus({
    gemini: { server: "configured", classroom_enabled: true, model: "   " },
  });
  assert.equal(blank.model, null);

  const serverOff = readAdvisoryStatus({
    gemini: { server: "not_configured", classroom_enabled: false, model: "gemini-x" },
  });
  assert.equal(serverOff.model, null);
});

test("withClassroomSetting moves only the half this screen controls", () => {
  const ready = readAdvisoryStatus({
    gemini: { server: "configured", classroom_enabled: true, status: "enabled", model: "gemini-x" },
  });

  const turnedOff = withClassroomSetting(ready, false);
  assert.equal(turnedOff.classroomEnabled, false);
  assert.equal(turnedOff.status, ADVISORY_STATUS.DISABLED);
  assert.equal(turnedOff.serverConfigured, true);
  assert.equal(turnedOff.model, "gemini-x");

  const notSetUp = readAdvisoryStatus({ gemini: { server: "not_configured" } });
  assert.equal(withClassroomSetting(notSetUp, true).status, ADVISORY_STATUS.UNAVAILABLE);
});

test("each state has its own label and sentence", () => {
  const labels = Object.values(ADVISORY_STATUS).map((status) => ADVISORY_STATUS_TEXT[status].label);
  assert.deepEqual(labels, ["Enabled", "Disabled", "Unavailable"]);
  assert.equal(new Set(labels).size, 3);

  const details = Object.values(ADVISORY_STATUS).map((s) => ADVISORY_STATUS_TEXT[s].detail);
  assert.equal(new Set(details).size, 3);
});

test("saveSuccessMessage names the state the save produced", () => {
  assert.equal(saveSuccessMessage(true), "AI suggestions turned on.");
  assert.equal(saveSuccessMessage(false), "AI suggestions turned off.");
});

test("saveFailureMessage distinguishes the failures a teacher can act on", () => {
  assert.match(saveFailureMessage({ status: 401 }), /Sign in again/);
  assert.match(saveFailureMessage({ code: "no_session" }), /Sign in again/);
  assert.match(saveFailureMessage({ status: 403 }), /cannot change school settings/);
  assert.match(saveFailureMessage({ status: 404 }), /not available on this deployment/);
  assert.match(saveFailureMessage({ code: "api_unconfigured" }), /not available on this deployment/);
  assert.match(saveFailureMessage({ status: 500 }), /could not be changed/);
  assert.match(saveFailureMessage(null), /could not be changed/);
});

test("saveFailureMessage never reports the setting as on or off", () => {
  for (const result of [{ status: 401 }, { status: 403 }, { status: 404 }, { status: 500 }]) {
    const message = saveFailureMessage(result);
    assert.doesNotMatch(message, /turned (on|off)/i);
    assert.match(message, /as it was|Sign in again|cannot change school settings/);
  }
});

test("readFailureMessage is absent when the read worked", () => {
  assert.equal(readFailureMessage(undefined), undefined);
  assert.equal(readFailureMessage(null), undefined);
  assert.match(readFailureMessage("unconfigured"), /not configured for this deployment/);
  assert.match(readFailureMessage("session"), /Sign in again/);
  assert.match(readFailureMessage("unavailable"), /could not be loaded/);
});
