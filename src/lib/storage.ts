import { v4 as uuidv4 } from "uuid";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchImageFromUrl, uploadToR2 } from "@/lib/r2";

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
  contentType: string
): Promise<string> {
  await ensureImagesBucket();

  const admin = createAdminClient();
  const { error } = await admin.storage.from(STORAGE_BUCKET).upload(key, body, {
    contentType,
    upsert: false,
  });

  if (error) throw error;

  const { data } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(key);
  return data.publicUrl;
}

export async function uploadImage(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  try {
    return await uploadToR2(key, body, contentType);
  } catch (r2Error) {
    console.warn("R2 upload failed, using Supabase Storage:", r2Error);
    return uploadToSupabaseStorage(key, body, contentType);
  }
}

export function buildUploadKey(userId: string, contentType: string): string {
  const ext = contentType === "image/jpeg" ? "jpg" : "png";
  return `uploads/${userId}/${uuidv4()}.${ext}`;
}

export function buildOutputKey(userId: string): string {
  return `outputs/${userId}/${uuidv4()}.png`;
}

export { fetchImageFromUrl };
