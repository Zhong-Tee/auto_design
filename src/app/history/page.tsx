import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Generation } from "@/types/database";

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data: generations } = await supabase
    .from("generations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  const items = (generations ?? []) as Generation[];

  return (
    <div className="page-container-wide">
      <h1 className="page-title">ประวัติการสร้างรูป</h1>

      {items.length === 0 ? (
        <p className="text-muted-foreground">ยังไม่มีประวัติการสร้างรูป</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((gen) => (
            <Card key={gen.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    {new Date(gen.created_at).toLocaleString("th-TH")}
                  </CardTitle>
                  <Badge
                    variant={
                      gen.status === "success"
                        ? "default"
                        : gen.status === "failed"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {gen.status === "success"
                      ? "สำเร็จ"
                      : gen.status === "failed"
                        ? "ล้มเหลว"
                        : "รอดำเนินการ"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {gen.output_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={gen.output_image_url}
                    alt="ผลลัพธ์"
                    className="h-40 w-full rounded-md border object-cover"
                  />
                ) : (
                  <div className="flex h-40 items-center justify-center rounded-md border bg-muted text-sm text-muted-foreground">
                    {gen.error_message || "ไม่มีรูป"}
                  </div>
                )}
                <p className="text-sm">
                  Token รวม: {gen.total_tokens.toLocaleString()} ·{" "}
                  <span className="font-semibold">
                    {Number(gen.cost_thb).toFixed(2)} บาท
                  </span>
                </p>
                {gen.output_image_url && (
                  <a
                    href={gen.output_image_url}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className={buttonVariants({ size: "sm", variant: "outline" })}
                  >
                    ดาวน์โหลด PNG
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
