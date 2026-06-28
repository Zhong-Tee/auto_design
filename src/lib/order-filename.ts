const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/g;

export function sanitizeOrderNumber(raw: string): string {
  return raw
    .trim()
    .replace(INVALID_FILENAME_CHARS, "-")
    .replace(/\s+/g, "_")
    .slice(0, 100);
}

export function buildOutputFileName(orderNumber: string): string {
  const safe = sanitizeOrderNumber(orderNumber);
  if (!safe) {
    throw new Error("เลขออเดอร์ไม่ถูกต้อง");
  }
  return `${safe}.png`;
}
