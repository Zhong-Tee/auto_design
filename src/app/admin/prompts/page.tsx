import { getPrompts } from "./actions";
import { PromptsPanel } from "./prompts-panel";

export default async function AdminPromptsPage() {
  const prompts = await getPrompts();
  return <PromptsPanel initialPrompts={prompts ?? []} />;
}
