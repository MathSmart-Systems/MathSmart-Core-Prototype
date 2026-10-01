"use client";

import { useCallback, useState } from "react";
import { Bot, LoaderCircle, LockKeyhole } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { Toast } from "@/modules/shared";

import { fetchSettings, saveAdvisoryEnabled } from "../services/settings-api";
import {
  ADVISORY_STATUS,
  ADVISORY_STATUS_TEXT,
  readAdvisoryStatus,
  saveFailureMessage,
  saveSuccessMessage,
  withClassroomSetting,
} from "../utils/settings-helpers";

/** The switch, named the way the rest of the workspace names its controls. */
const TOGGLE_ID = "teacher-settings-gemini-toggle";

function StatusRow({ label, value, testId }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 py-2 sm:block sm:py-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold text-foreground sm:mt-1" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

/**
 * School-wide settings for the Teacher/Administrator workspace.
 *
 * One setting lives here today — whether teachers may ask for AI suggestions
 * on an intervention case — and the screen is built so a second one can sit
 * beside it as its own section rather than as another row in a form.
 *
 * Three rules shape it.
 *
 * Both halves of the answer are on screen. Gemini answers only when the server
 * is configured and the classroom setting is on, so "why is it off?" is
 * answered by the status block rather than by asking an administrator.
 *
 * The switch commits on use. A single boolean with a Save button invites the
 * state where the screen and the school disagree about what is on. The switch
 * moves immediately, the save follows, and a refusal puts it back where the
 * server says it is. The confirmation is a toast, so nothing the teacher just
 * reached for moves under them.
 *
 * What is absent is deliberate. There is no API key here and no field that
 * could hold one; the only Gemini detail on screen is the read-only model
 * identifier the settings contract publishes, shown as a fact about the server
 * rather than beside generated text.
 *
 * @param {object} props
 * @param {object|null} props.initialSettings - `data` from the server read
 * @param {string} [props.initialError] - A sentence to show when that read failed
 */
export function SettingsView({ initialSettings, initialError }) {
  const [advisory, setAdvisory] = useState(() => readAdvisoryStatus(initialSettings));
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const text = ADVISORY_STATUS_TEXT[advisory.status] ?? ADVISORY_STATUS_TEXT[ADVISORY_STATUS.UNAVAILABLE];
  const locked = !advisory.serverConfigured || Boolean(initialError);

  const change = useCallback(
    async (enabled) => {
      const before = advisory;
      setSaving(true);
      // The server half cannot have moved, so the screen can show the new
      // state at once instead of waiting for a round trip to confirm it.
      setAdvisory(withClassroomSetting(before, enabled));

      const saved = await saveAdvisoryEnabled(enabled);
      if (!saved.ok) {
        setAdvisory(before);
        setSaving(false);
        setToast({ tone: "error", message: saveFailureMessage(saved) });
        return;
      }

      // The save reports which keys changed, not the configuration it
      // produced, so the screen reads the configuration back rather than
      // trusting its own guess about it.
      const refreshed = await fetchSettings();
      if (refreshed.ok && refreshed.data) setAdvisory(readAdvisoryStatus(refreshed.data));
      setSaving(false);
      setToast({ tone: "success", message: saveSuccessMessage(enabled) });
    },
    [advisory],
  );

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          School-wide choices for this MathSmart workspace. They apply to every teacher and every
          class.
        </p>
      </header>

      {initialError ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-foreground"
        >
          {initialError}
        </p>
      ) : null}

      <section
        aria-labelledby="advisory-setting-heading"
        className="w-full min-w-0 space-y-5 rounded-xl border border-border bg-card p-4 shadow-xs sm:p-6"
      >
        <div className="flex items-start gap-2 border-b border-border pb-3">
          <Bot aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <h2
              id="advisory-setting-heading"
              className="font-display text-xl font-semibold tracking-tight text-foreground"
            >
              AI suggestions
            </h2>
            <p className="mt-0.5 max-w-prose text-xs leading-relaxed text-muted-foreground">
              Optional wording help: suggested support plans on an intervention case. Scores,
              mastery, progress and intervention triggers never depend on it, and nothing reaches a
              learner&rsquo;s record until a teacher writes it into their own notes.
            </p>
          </div>
        </div>

        <dl className="grid divide-y divide-border rounded-lg border border-border bg-muted/30 px-4 py-1 sm:grid-cols-3 sm:gap-4 sm:divide-y-0 sm:py-3">
          <StatusRow
            label="Server"
            value={advisory.serverConfigured ? "Configured" : "Not configured"}
            testId="advisory-server"
          />
          <StatusRow
            label="Classroom setting"
            value={advisory.classroomEnabled ? "On" : "Off"}
            testId="advisory-classroom"
          />
          <StatusRow label="AI suggestions" value={text.label} testId="advisory-status" />
        </dl>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
          <div className="min-w-0 flex-1 space-y-0.5">
            <label htmlFor={TOGGLE_ID} className="block text-sm font-semibold text-foreground">
              Allow AI suggestions
            </label>
            <p id={`${TOGGLE_ID}-detail`} className="text-xs leading-relaxed text-muted-foreground">
              {text.detail}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* Reserved rather than conditional, so saving does not shuffle
                the switch sideways under the finger that just pressed it. */}
            <LoaderCircle
              aria-hidden="true"
              className={`size-4 animate-spin text-muted-foreground motion-reduce:animate-none ${
                saving ? "" : "invisible"
              }`}
            />
            <Switch
              id={TOGGLE_ID}
              checked={advisory.classroomEnabled}
              disabled={locked || saving}
              aria-describedby={`${TOGGLE_ID}-detail`}
              aria-busy={saving}
              onCheckedChange={change}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-1.5">
            <LockKeyhole aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            The Gemini API key is kept on the server. It cannot be viewed or edited here.
          </p>
          {advisory.model ? (
            <p className="min-w-0 break-words">
              Model (set on the server):{" "}
              <span className="font-medium text-foreground" data-testid="advisory-model">
                {advisory.model}
              </span>
            </p>
          ) : null}
        </div>
      </section>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
