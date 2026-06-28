import {
  getPatterns,
  getProductsForSelect,
  getPromptsForSelect,
} from "./actions";
import { PatternsPanel } from "./patterns-panel";

export default async function AdminPatternsPage() {
  const [patterns, products, prompts] = await Promise.all([
    getPatterns(),
    getProductsForSelect(),
    getPromptsForSelect(),
  ]);

  return (
    <PatternsPanel
      initialPatterns={patterns ?? []}
      products={products}
      prompts={prompts}
    />
  );
}
