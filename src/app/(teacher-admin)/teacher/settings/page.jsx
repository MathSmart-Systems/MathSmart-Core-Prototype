import { readFailureMessage, readSettingsData, SettingsView } from "@/modules/teacher-admin/settings";

export const metadata = { title: "Settings | MathSmart" };

export const dynamic = "force-dynamic";

/**
 * School-wide settings for the Teacher/Administrator workspace.
 *
 * The configuration is read on the server with the caller's own token, so the
 * first paint already shows the real state of the switch rather than a
 * placeholder that corrects itself.
 */
export default async function TeacherSettingsPage() {
  const { settings, error } = await readSettingsData();

  return <SettingsView initialSettings={settings} initialError={readFailureMessage(error)} />;
}
