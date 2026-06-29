import type { ShapeQuality } from "@/types/database";

export const QUALITY_OPTIONS = [
  { label: "น้อย", value: "low" as ShapeQuality },
  { label: "กลาง", value: "medium" as ShapeQuality },
  { label: "มาก", value: "high" as ShapeQuality },
  { label: "สูงมาก", value: "high" as ShapeQuality },
];

export const EXPERIMENTAL_MAX_WIDTH = 2560;
export const EXPERIMENTAL_MAX_HEIGHT = 1440;

/** gpt-image-2 API constraints */
export const GPT_IMAGE_MIN_PIXELS = 655_360;
export const GPT_IMAGE_MAX_PIXELS = 8_294_400;
export const GPT_IMAGE_MAX_EDGE = 3840;
export const GPT_IMAGE_SIZE_STEP = 16;
export const GPT_IMAGE_MAX_ASPECT_RATIO = 3;

export function isExperimentalResolution(width: number, height: number): boolean {
  return width > EXPERIMENTAL_MAX_WIDTH || height > EXPERIMENTAL_MAX_HEIGHT;
}

export function getShapeSizeErrors(width: number, height: number): string[] {
  const errors: string[] = [];

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    errors.push("ความกว้างและความสูงต้องมากกว่า 0");
    return errors;
  }

  if (width % GPT_IMAGE_SIZE_STEP !== 0 || height % GPT_IMAGE_SIZE_STEP !== 0) {
    errors.push("ความกว้างและความสูงต้องหาร 16 ลงตัว");
  }

  const pixels = width * height;
  if (pixels < GPT_IMAGE_MIN_PIXELS) {
    errors.push(
      `พิกเซลรวม ${pixels.toLocaleString()} ต่ำกว่าขั้นต่ำ ${GPT_IMAGE_MIN_PIXELS.toLocaleString()} (gpt-image-2) — ลองขยายขนาด เช่น 576×1152 หรือ 1024×1024`
    );
  }

  if (pixels > GPT_IMAGE_MAX_PIXELS) {
    errors.push(
      `พิกเซลรวมต้องไม่เกิน ${GPT_IMAGE_MAX_PIXELS.toLocaleString()}`
    );
  }

  const longEdge = Math.max(width, height);
  const shortEdge = Math.min(width, height);

  if (longEdge > GPT_IMAGE_MAX_EDGE) {
    errors.push(`ด้านที่ยาวที่สุดต้องไม่เกิน ${GPT_IMAGE_MAX_EDGE}px`);
  }

  if (shortEdge > 0 && longEdge > GPT_IMAGE_MAX_ASPECT_RATIO * shortEdge) {
    errors.push("อัตราส่วนด้านยาว:ด้านสั้น ต้องไม่เกิน 3:1");
  }

  return errors;
}

export function isValidShapeSize(width: number, height: number): boolean {
  return getShapeSizeErrors(width, height).length === 0;
}

export function assertValidShapeSize(width: number, height: number): void {
  const errors = getShapeSizeErrors(width, height);
  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }
}

export function formatQualityLabel(quality: ShapeQuality): string {
  const option = QUALITY_OPTIONS.find((o) => o.value === quality);
  return option?.label ?? quality;
}

export function formatSize(width: number, height: number): string {
  return `${width}×${height} px`;
}

export const DEFAULT_GENERATION_WIDTH = 1024;
export const DEFAULT_GENERATION_HEIGHT = 1024;
export const DEFAULT_GENERATION_QUALITY: ShapeQuality = "medium";
