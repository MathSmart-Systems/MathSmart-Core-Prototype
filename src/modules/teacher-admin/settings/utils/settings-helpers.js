/**
 * Pure reading of the settings payload, kept out of the components.
 *
 * Two separate things decide whether Gemini answers: the server, which a
 * deployment sets up in `.env` and this screen can neither see nor change, and
 * the classroom setting a Teacher/Administrator controls here. The reply
 * reports both, and these helpers keep them apart so the screen can say which
 * one is holding it back rather than only that something is.
 *
 * Anything missing reads as off. A screen that assumed "on" when the API said
 * nothing would promise advice the server is not going to give.
 *
 * The shape and the vocabulary follow the live-accepted Teacher Settings
 * screen in the full MathSmart application, so a teacher moving between the
 * two reads the same words for the same states.
 */

/** The three states a teacher is shown. */
export const ADVISORY_STATUS = Object.freeze({
  ENABLED: "enabled",
  DISABLED: "disabled",
  UNAVAILABLE: "unavailable",
});

const STATUS_VALUES = new Set(Object.values(ADVISORY_STATUS));

/** What the teacher reads for each state. */
export const ADVISORY_STATUS_TEXT = Object.freeze({
  [ADVISORY_STATUS.ENABLED]: {
    label: "Enabled",
    detail: "Optional AI suggestions can be requested.",
  },
  [ADVISORY_STATUS.DISABLED]: {
    label: "Disabled",
    detail: "Turned off for this school. No AI suggestions are requested.",
  },
  [ADVISORY_STATUS.UNAVAILABLE]: {
    label: "Unavailable",
    detail: "Gemini is not set up on the server, so no AI suggestions can be requested.",
  },
});

/**
 * The advisory block of a settings reply, with both halves kept apart.
 *
 * @param {object|null|undefined} data - `data` from `GET /teacher-admin/settings`
 * @returns {{serverConfigured: boolean, classroomEnabled: boolean, status: string, model: string|null}}
 */
export function readAdvisoryStatus(data) {
  const gemini = data?.gemini && typeof data.gemini === "object" ? data.gemini : {};

  const serverConfigured = gemini.server === "configured";
  const classroomEnabled = gemini.classroom_enabled === true;

  let status = STATUS_VALUES.has(gemini.status) ? gemini.status : null;
  if (!status) {
    if (!serverConfigured) status = ADVISORY_STATUS.UNAVAILABLE;
    else status = classroomEnabled ? ADVISORY_STATUS.ENABLED : ADVISORY_STATUS.DISABLED;
  }

  const model =
    serverConfigured && typeof gemini.model === "string" && gemini.model.trim()
      ? gemini.model.trim()
      : null;

  return { serverConfigured, classroomEnabled, status, model };
}

/**
 * The status after the classroom setting has been changed here, without
 * waiting for another read: the server half cannot have moved.
 *
 * @param {ReturnType<typeof readAdvisoryStatus>} current
 * @param {boolean} classroomEnabled
 */
export function withClassroomSetting(current, classroomEnabled) {
  let status = ADVISORY_STATUS.UNAVAILABLE;
  if (current.serverConfigured) {
    status = classroomEnabled ? ADVISORY_STATUS.ENABLED : ADVISORY_STATUS.DISABLED;
  }
  return { ...current, classroomEnabled, status };
}

/**
 * What to say after a save that worked, named after the state it produced.
 *
 * @param {boolean} enabled - The state the setting is now in
 * @returns {string}
 */
export function saveSuccessMessage(enabled) {
  return enabled ? "AI suggestions turned on." : "AI suggestions turned off.";
}

/**
 * What to say after a save that did not happen, in the teacher's terms.
 *
 * The diagnosis belongs in the server log. What a teacher needs is which
 * state the setting is actually in, which is the one it was in before.
 *
 * @param {object|null|undefined} result - The normalised API reply
 * @returns {string}
 */
export function saveFailureMessage(result) {
  const status = result && typeof result === "object" ? result.status : null;
  const code = result && typeof result === "object" ? result.code : null;

  if (code === "no_session" || status === 401) {
    return "Your session has ended. Sign in again to change this setting.";
  }
  if (status === 403) {
    return "This account cannot change school settings.";
  }
  if (status === 404 || code === "api_unconfigured") {
    return "Settings are not available on this deployment. The setting is as it was.";
  }
  return "AI suggestions could not be changed. The setting is as it was.";
}

/**
 * What to say when the page itself could not read the settings.
 *
 * @param {string|null|undefined} error - The reason from the server read
 * @returns {string|undefined}
 */
export function readFailureMessage(error) {
  if (!error) return undefined;
  if (error === "unconfigured") {
    return "Settings are not configured for this deployment. Contact your administrator.";
  }
  if (error === "session") {
    return "Your session could not be verified. Sign in again and retry.";
  }
  return "Settings could not be loaded. Try again.";
}
