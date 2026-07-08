import { getSettings } from "./actions";
import { SettingsPanel } from "./settings-panel";

export default async function AdminSettingsPage() {
  const { pricing, imageModel } = await getSettings();
  return <SettingsPanel settings={pricing} imageModel={imageModel} />;
}
