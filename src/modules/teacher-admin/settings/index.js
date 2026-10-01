/**
 * Public surface of the Teacher/Administrator Settings workspace.
 *
 * The route reads the effective configuration on the server and hands it to
 * `SettingsView`, which owns the one control on the screen. The browser
 * transport and the reply helpers stay private to this module.
 */
export { SettingsView } from "./components/SettingsView";
export { readSettingsData } from "./services/settings-data";
export { readFailureMessage } from "./utils/settings-helpers";
