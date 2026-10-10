import type { GenerationResult, TokenUsage } from "@/types/database";
import { sanitizeOrderNumber } from "@/lib/order-filename";

export type QueueItemStatus = "pending" | "processing" | "success" | "failed" | "cancelled";

export function isQueueActive(item: Pick<QueueItem, "status">): boolean {
  return item.status === "pending" || item.status === "processing";
}

export interface QueuePayload {
  productId?: string;
  patternId?: string;
  artStyleId?: string;
  orderNumber: string;
  texts: string[];
  /** ค่าตัวแปรกำหนดเองของ Art Style เช่น { suite: "ชุดนักบิน" } */
  variables?: Record<string, string>;
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
  step?: string;
  attemptCount?: number;
  warning?: string;
  connectionError?: string;
  processingStartedAt?: string;
  cancelling?: boolean;
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
      cancelling: false,
    }));
}

export interface GenerationStatusResponse {
  generationId: string;
  status: QueueItemStatus;
  createdAt?: string;
  completedAt?: string;
  processingStartedAt?: string;
  step?: string;
  attemptCount?: number;
  heartbeatAt?: string;
  warning?: string;
  orderNumber?: string;
  outputImageUrl?: string;
  outputFileName?: string;
  promptUsed?: string;
  model?: string;
  usage?: TokenUsage;
  costUsd?: number;
  costThb?: number;
  costThbDisplay?: string;
  processingMs?: number;
  error?: string;
}

export function applyGenerationStatus(
  item: QueueItem,
  data: GenerationStatusResponse
): QueueItem {
  item = {
    ...item, step: data.step, attemptCount: data.attemptCount, warning: data.warning,
    connectionError: undefined, processingStartedAt: data.processingStartedAt,
    startedAt: data.createdAt ?? item.startedAt,
  };
  if (data.status === "pending" || data.status === "processing") {
    return {
      ...item,
      generationId: data.generationId,
      status: data.status,
    };
  }

  if (data.status === "failed" || data.status === "cancelled") {
    return {
      ...item,
      generationId: data.generationId,
      status: data.status,
      completedAt: data.completedAt ?? item.completedAt ?? new Date().toISOString(),
      error: data.error ?? "สร้างรูปไม่สำเร็จ",
    };
  }

  return {
    ...item,
    generationId: data.generationId,
    status: "success",
    completedAt: data.completedAt ?? item.completedAt ?? new Date().toISOString(),
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
      processingMs: data.processingMs,
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
    isQueueActive(item)
      ? now
      : new Date(item.completedAt ?? item.startedAt).getTime();

  return end - start;
}

export function getQueueStatusLabel(status: QueueItemStatus): string {
  if (status === "pending") return "รอคิว";
  if (status === "cancelled") return "ยกเลิกแล้ว";
  if (status === "processing") return "กำลังสร้าง";
  if (status === "success") return "เสร็จแล้ว";
  return "ล้มเหลว";
}

export function getQueueStepLabel(item: QueueItem): string {
  if (item.cancelling) return "กำลังยกเลิก";
  if (!item.generationId && isQueueActive(item)) return "กำลังส่งคำขอ";
  const steps: Record<string, string> = {
    loading: "กำลังโหลดภาพ", generating: "กำลังสร้างภาพ", retrying: "รอลองใหม่", saving: "กำลังบันทึกภาพ",
  };
  return isQueueActive(item) && item.step && steps[item.step]
    ? steps[item.step] : getQueueStatusLabel(item.status);
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
      (isQueueActive(item) || item.status === "success") &&
      normalizeOrderNumber(item.orderNumber) === normalized
  );
}
