import { createClient } from "@/lib/supabase/server";
import { GenerateForm } from "@/app/generate-form";

export default async function HomePage() {
  const supabase = await createClient();
  const [productsRes, shapesRes] = await Promise.all([
    supabase.from("products").select("*").eq("is_active", true).order("name"),
    supabase.from("shapes").select("*").eq("is_active", true).order("name"),
  ]);

  return (
    <GenerateForm
      initialProducts={productsRes.data ?? []}
      initialShapes={shapesRes.data ?? []}
    />
  );
}
