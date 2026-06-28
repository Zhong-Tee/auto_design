import { v4 as uuidv4 } from "uuid";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteFromR2, fetchImageFromUrl, uploadToR2 } from "@/lib/r2";
import { buildOutputFileName } from "@/lib/order-filename";

const STORAGE_BUCKET = "images";
let bucketReady = false;

async function ensureImagesBucket() {
  if (bucketReady) return;

  const admin = createAdminClient();
  const { data: buckets, error } = await admin.storage.listBuckets();
  if (error) throw error;

  if (!buckets?.some((bucket) => bucket.name === STORAGE_BUCKET)) {
    const { error: createError } = await admin.storage.createBucket(
      STORAGE_BUCKET,
      {
        public: true,
        fileSizeLimit: 10 * 1024 * 1024,
      }
    );
    if (createError) throw createError;
  }

  bucketReady = true;
}

async function uploadToSupabaseStorage(
  key: string,
  body: Buffer,
  contentType: string,
  upsert = false
): Promise<string> {
  await ensureImagesBucket();

  const admin = createAdminClient();
  const { error } = await admin.storage.from(STORAGE_BUCKET).upload(key, body, {
    contentType,
    upsert,
  });

  if (error) throw error;

  const { data } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(key);
  return data.publicUrl;
}

export async function uploadImage(
  key: string,
  body: Buffer,
  contentType: string,
  options?: { upsert?: boolean }
): Promise<string> {
  const upsert = options?.upsert ?? false;
  try {
    return await uploadToR2(key, body, contentType);
  } catch (r2Error) {
    console.warn("R2 upload failed, using Supabase Storage:", r2Error);
    return uploadToSupabaseStorage(key, body, contentType, upsert);
  }
}

export function buildUploadKey(userId: string, contentType: string): string {
  const ext = contentType === "image/jpeg" ? "jpg" : "png";
  return `uploads/${userId}/${uuidv4()}.${ext}`;
}

export function buildOutputKey(userId: string, orderNumber?: string): string {
  if (orderNumber) {
    return `outputs/${userId}/${buildOutputFileName(orderNumber)}`;
  }
  return `outputs/${userId}/${uuidv4()}.png`;
}

export function getStorageKeyFromUrl(url: string): string | null {
  const r2Base = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (r2Base && url.startsWith(`${r2Base}/`)) {
    return url.slice(r2Base.length + 1);
  }

  const supabaseMatch = url.match(
    /\/storage\/v1\/object\/public\/images\/(.+)$/
  );
  if (supabaseMatch) {
    return decodeURIComponent(supabaseMatch[1]);
  }

  return null;
}

export async function deleteStoredImage(url: string): Promise<void> {
  const key = getStorageKeyFromUrl(url);
  if (!key) return;

  try {
    await deleteFromR2(key);
    return;
  } catch (r2Error) {
    console.warn("R2 delete failed, trying Supabase Storage:", r2Error);
  }

  await ensureImagesBucket();
  const admin = createAdminClient();
  const { error } = await admin.storage.from(STORAGE_BUCKET).remove([key]);
  if (error) throw error;
}

export { fetchImageFromUrl };
