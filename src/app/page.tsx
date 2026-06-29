import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { formatProfileLabel } from "@/lib/profile";
import { GenerateForm } from "@/app/generate-form";

export default async function HomePage() {
  const supabase = await createClient();
  const [productsRes, profile] = await Promise.all([
    supabase.from("products").select("*").eq("is_active", true).order("name"),
    getCurrentProfile(),
  ]);

  return (
    <GenerateForm
      initialProducts={productsRes.data ?? []}
      userName={formatProfileLabel(profile)}
    />
  );
}
