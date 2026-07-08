import { getArtStyles, getPromptsForSelect } from "./actions";
import { ArtStylesPanel } from "./art-styles-panel";

export default async function AdminArtStylesPage() {
  const [artStyles, prompts] = await Promise.all([
    getArtStyles(),
    getPromptsForSelect(),
  ]);

  return <ArtStylesPanel initialArtStyles={artStyles ?? []} prompts={prompts} />;
}
