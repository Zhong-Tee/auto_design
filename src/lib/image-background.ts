import sharp from "sharp";

export type ImageBackground = "auto" | "opaque" | "transparent";

// Existing templates express background requirements in their prompt.
// Match background instructions, not transparent clothing or other objects.
export function resolveImageBackground(prompt: string): ImageBackground {
  const instructions = prompt
    .replace(/(?:not\s+(?:(?:use|render|make)\s+)?(?:a\s+)?|no\s+|non[-\s]+)transparent\s+background/gi, "opaque background")
    .replace(/(?:ไม่ต้องการ|ไม่ใช้|ไม่เอา|ไม่ใช่|ห้ามใช้)\s*(?:พื้นหลัง|ฉากหลัง)\s*โปร่งใส/g, "พื้นหลังทึบ");

  return /\btransparent[-\s]+background\b|\bbackground\s*(?:[:=]\s*)?(?:is\s+)?transparent\b|\b(?:no|without)\s+(?:a\s+)?background\b|(?:พื้นหลัง|ฉากหลัง)\s*(?:แบบ\s*)?โปร่งใส|(?:ไม่มี|ไม่เอา|ลบ)\s*(?:พื้นหลัง|ฉากหลัง)/i.test(instructions)
    ? "transparent"
    : "auto";
}

export async function assertTransparentPng(imageBuffer: Buffer): Promise<void> {
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  if (metadata.format !== "png" || !metadata.hasAlpha) {
    throw new Error("ภาพที่ได้รับไม่มีพื้นหลังโปร่งใสจริง กรุณาสร้างใหม่");
  }

  const { channels } = await image.stats();
  const alpha = channels[channels.length - 1];
  if (!alpha || alpha.min === 255 || alpha.max === 0) {
    throw new Error("ภาพที่ได้รับไม่มีพื้นหลังโปร่งใสที่ใช้งานได้ กรุณาสร้างใหม่");
  }
}
