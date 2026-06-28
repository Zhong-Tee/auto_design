import type { ShapeQuality } from "@/types/database";

export const QUALITY_OPTIONS = [
  { label: "น้อย", value: "low" as ShapeQuality },
  { label: "กลาง", value: "medium" as ShapeQuality },
  { label: "มาก", value: "high" as ShapeQuality },
  { label: "สูงมาก", value: "high" as ShapeQuality },
];

export const EXPERIMENTAL_MAX_WIDTH = 2560;
export const EXPERIMENTAL_MAX_HEIGHT = 1440;

export function isExperimentalResolution(width: number, height: number): boolean {
  return width > EXPERIMENTAL_MAX_WIDTH || height > EXPERIMENTAL_MAX_HEIGHT;
}

export function formatQualityLabel(quality: ShapeQuality): string {
  const option = QUALITY_OPTIONS.find((o) => o.value === quality);
  return option?.label ?? quality;
}

export function formatSize(width: number, height: number): string {
  return `${width}×${height} px`;
}
