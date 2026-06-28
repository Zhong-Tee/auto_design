import { getSettings } from "./actions";
import { SettingsPanel } from "./settings-panel";

export default async function AdminSettingsPage() {
  const settings = await getSettings();
  return <SettingsPanel settings={settings} />;
}
