import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { buildOutputFileName } from "@/lib/order-filename";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  // The session client's RLS permits only the owner or an administrator.
  const { data: generation, error } = await supabase
    .from("generations")
    .select("output_image_url, order_number, status")
    .eq("id", id)
    .single();
  if (error || !generation) {
    return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });
  }
  if (generation.status !== "success" || !generation.output_image_url) {
    return NextResponse.json({ error: "รูปยังไม่พร้อมดาวน์โหลด" }, { status: 409 });
  }

  try {
    const imageUrl = new URL(generation.output_image_url);
    const allowedBases = [
      process.env.R2_PUBLIC_BASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_URL
        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/images`
        : undefined,
    ].filter((base): base is string => Boolean(base));
    const allowed = imageUrl.protocol === "https:" && allowedBases.some((base) => {
      const baseUrl = new URL(base);
      return imageUrl.origin === baseUrl.origin &&
        imageUrl.pathname.startsWith(`${baseUrl.pathname.replace(/\/$/, "")}/`);
    });
    if (!allowed || imageUrl.username || imageUrl.password) {
      return NextResponse.json({ error: "ที่อยู่รูปไม่ถูกต้อง" }, { status: 502 });
    }

    const image = await fetch(imageUrl, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
    if (!image.ok || !image.body) {
      return NextResponse.json({ error: "ดาวน์โหลดรูปไม่สำเร็จ กรุณาลองใหม่" }, { status: 502 });
    }

    const filename = buildOutputFileName(generation.order_number || "output")
      .replace(/[\u0000-\u001f\u007f]/g, "_");
    const encodedFilename = encodeURIComponent(filename)
      .replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

    return new Response(image.body, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="output.png"; filename*=UTF-8''${encodedFilename}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "ดาวน์โหลดรูปไม่สำเร็จ กรุณาลองใหม่" }, { status: 502 });
  }
}
