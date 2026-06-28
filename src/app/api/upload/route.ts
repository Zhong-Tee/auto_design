import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildUploadKey,
  uploadImage,
} from "@/lib/storage";
import { resolveImageContentType } from "@/lib/image-content-type";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "กรุณาเลือกไฟล์รูป" }, { status: 400 });
    }

    const contentType = resolveImageContentType(file);
    if (!contentType) {
      return NextResponse.json(
        { error: "รองรับเฉพาะไฟล์ PNG และ JPEG" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "ไฟล์ใหญ่เกิน 10MB" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const key = buildUploadKey(user.id, contentType);
    const url = await uploadImage(key, buffer, contentType);

    return NextResponse.json({ url, key });
  } catch (error) {
    console.error("Upload failed:", error);
    return NextResponse.json(
      { error: "อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่" },
      { status: 500 }
    );
  }
}
