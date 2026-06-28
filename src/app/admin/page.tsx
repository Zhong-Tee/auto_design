import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [users, products, generations, failed] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("products").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("generations").select("*", { count: "exact", head: true }).eq("status", "success"),
    supabase.from("generations").select("*", { count: "exact", head: true }).eq("status", "failed"),
  ]);

  const stats = [
    { title: "ผู้ใช้ทั้งหมด", value: users.count ?? 0 },
    { title: "สินค้า (เปิดใช้)", value: products.count ?? 0 },
    { title: "รูปที่สร้างสำเร็จ", value: generations.count ?? 0 },
    { title: "รูปที่ล้มเหลว", value: failed.count ?? 0 },
  ];

  return (
    <div>
      <h1 className="page-title">แดชบอร์ด</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
