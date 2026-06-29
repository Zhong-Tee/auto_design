import type { GenerationResult, TokenUsage } from "@/types/database";
import { sanitizeOrderNumber } from "@/lib/order-filename";

export type QueueItemStatus = "processing" | "success" | "failed";

export interface QueuePayload {
  productId: string;
  patternId: string;
  orderNumber: string;
  texts: string[];
  uploadedImageUrl: string | null;
}

export interface QueueItem {
  id: string;
  generationId?: string;
  createdAt: string;
  startedAt: string;
  completedAt?: string;
  orderNumber: string;
  userName: string;
  productName: string;
  patternName: string;
  status: QueueItemStatus;
  payload: QueuePayload;
  result?: GenerationResult & { usage: TokenUsage };
  error?: string;
}

const STORAGE_KEY = "tr-generate-queue";

export function loadQueueFromStorage(): QueueItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as QueueItem[];
    if (!Array.isArray(parsed)) return [];

    return normalizeQueueOnLoad(parsed);
  } catch {
    return [];
  }
}

export function saveQueueToStorage(queue: QueueItem[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function normalizeQueueOnLoad(queue: QueueItem[]): QueueItem[] {
  return queue
    .filter((item) => item.payload)
    .map((item) => ({
      ...item,
      startedAt: item.startedAt ?? item.createdAt,
    }));
}

export interface GenerationStatusResponse {
  generationId: string;
  status: "pending" | "success" | "failed";
  orderNumber?: string;
  outputImageUrl?: string;
  outputFileName?: string;
  promptUsed?: string;
  model?: string;
  usage?: TokenUsage;
  costUsd?: number;
  costThb?: number;
  costThbDisplay?: string;
  error?: string;
}

export function applyGenerationStatus(
  item: QueueItem,
  data: GenerationStatusResponse
): QueueItem {
  if (data.status === "pending") {
    return {
      ...item,
      generationId: data.generationId,
      status: "processing",
    };
  }

  if (data.status === "failed") {
    return {
      ...item,
      generationId: data.generationId,
      status: "failed",
      completedAt: item.completedAt ?? new Date().toISOString(),
      error: data.error ?? "สร้างรูปไม่สำเร็จ",
    };
  }

  return {
    ...item,
    generationId: data.generationId,
    status: "success",
    completedAt: item.completedAt ?? new Date().toISOString(),
    result: {
      generationId: data.generationId,
      outputImageUrl: data.outputImageUrl!,
      outputFileName: data.outputFileName ?? `${item.orderNumber}.png`,
      orderNumber: data.orderNumber ?? item.orderNumber,
      promptUsed: data.promptUsed ?? "",
      usage: data.usage ?? {
        input_text_tokens: 0,
        input_image_tokens: 0,
        output_image_tokens: 0,
        total_tokens: 0,
      },
      costUsd: data.costUsd ?? 0,
      costThb: data.costThb ?? 0,
      costThbDisplay: data.costThbDisplay ?? "0.00",
    },
  };
}

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function getQueueElapsedMs(item: QueueItem, now: number): number {
  const start = new Date(item.startedAt).getTime();
  const end =
    item.status === "processing"
      ? now
      : new Date(item.completedAt ?? item.startedAt).getTime();

  return end - start;
}

export function getQueueStatusLabel(status: QueueItemStatus): string {
  if (status === "processing") return "กำลังสร้าง";
  if (status === "success") return "เสร็จแล้ว";
  return "ล้มเหลว";
}

export function getQueueStatusVariant(status: QueueItemStatus) {
  if (status === "success") return "default" as const;
  if (status === "failed") return "destructive" as const;
  return "secondary" as const;
}

export function groupQueueByDay(
  items: QueueItem[]
): { label: string; items: QueueItem[] }[] {
  const groups = new Map<string, QueueItem[]>();
  const order: string[] = [];

  for (const item of items) {
    const label = new Date(item.createdAt).toLocaleDateString("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    if (!groups.has(label)) {
      groups.set(label, []);
      order.push(label);
    }

    groups.get(label)!.push(item);
  }

  return order.map((label) => ({ label, items: groups.get(label)! }));
}

export function normalizeOrderNumber(orderNumber: string): string {
  return sanitizeOrderNumber(orderNumber);
}

export function findActiveQueueDuplicate(
  queue: QueueItem[],
  orderNumber: string
): QueueItem | undefined {
  const normalized = normalizeOrderNumber(orderNumber);
  if (!normalized) return undefined;

  return queue.find(
    (item) =>
      (item.status === "processing" || item.status === "success") &&
      normalizeOrderNumber(item.orderNumber) === normalized
  );
}
