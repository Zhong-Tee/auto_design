import { getProducts } from "./actions";
import { ProductsPanel } from "./products-panel";

export default async function AdminProductsPage() {
  const products = await getProducts();
  return <ProductsPanel initialProducts={products ?? []} />;
}
