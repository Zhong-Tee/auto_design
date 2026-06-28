import { notFound } from "next/navigation";
import { getProduct } from "../actions";
import { ProductEditPanel } from "../product-edit-panel";

interface AdminProductEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminProductEditPage({
  params,
}: AdminProductEditPageProps) {
  const { id } = await params;

  try {
    const product = await getProduct(id);
    if (!product) notFound();
    return <ProductEditPanel initialProduct={product} />;
  } catch {
    notFound();
  }
}
