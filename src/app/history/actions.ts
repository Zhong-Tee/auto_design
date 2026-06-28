"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/session";
import { deleteStoredImage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function deleteGenerations(ids: string[]) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) {
    throw new Error("ไม่ได้เลือกรายการ");
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error("กรุณาเข้าสู่ระบบ");
  }

  const supabase = await createClient();
  const { data: rows, error: fetchError } = await supabase
    .from("generations")
    .select("id, user_id, output_image_url, uploaded_image_url")
    .in("id", uniqueIds);

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (!rows?.length) {
    throw new Error("ไม่พบรายการ");
  }

  if (rows.length !== uniqueIds.length) {
    throw new Error("ไม่พบรายการบางส่วน");
  }

  const isAdmin = profile.role === "admin";
  const hasUnauthorized = rows.some(
    (row) => row.user_id !== profile.id && !isAdmin
  );
  if (hasUnauthorized) {
    throw new Error("ไม่มีสิทธิ์ลบรายการนี้");
  }

  for (const row of rows) {
    for (const imageUrl of [row.output_image_url, row.uploaded_image_url]) {
      if (!imageUrl) continue;
      try {
        await deleteStoredImage(imageUrl);
      } catch (error) {
        console.warn("Failed to delete stored image:", imageUrl, error);
      }
    }
  }

  const rowIds = rows.map((row) => row.id);
  const admin = createAdminClient();
  const { error: deleteError } = await admin
    .from("generations")
    .delete()
    .in("id", rowIds);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  revalidatePath("/history");
  return { deleted: rowIds.length };
}
