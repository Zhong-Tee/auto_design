"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  applyGenerationStatus,
  isQueueActive,
  loadQueueFromStorage,
  saveQueueToStorage,
  type GenerationStatusResponse,
  type QueueItem,
  type QueuePayload,
} from "@/lib/generate-queue";

interface QueueItemInput {
  orderNumber: string;
  userName: string;
  productName: string;
  patternName: string;
  payload: QueuePayload;
}

interface GenerateQueueContextValue {
  queue: QueueItem[];
  now: number;
  enqueueGeneration: (input: QueueItemInput) => string;
  retryGeneration: (source: QueueItem) => string;
  cancelGeneration: (source: QueueItem) => Promise<void>;
  reconnectGeneration: (source: QueueItem) => void;
}

const GenerateQueueContext = createContext<GenerateQueueContextValue | null>(
  null
);

export function useGenerateQueue() {
  const context = useContext(GenerateQueueContext);
  if (!context) {
    throw new Error("useGenerateQueue must be used within GenerateQueueProvider");
  }
  return context;
}

export function GenerateQueueProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueHydrated, setQueueHydrated] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const submittedRef = useRef(new Set<string>());

  useEffect(() => {
    setQueue(loadQueueFromStorage());
    setQueueHydrated(true);
  }, []);

  useEffect(() => {
    if (!queueHydrated) return;
    saveQueueToStorage(queue);
  }, [queue, queueHydrated]);

  useEffect(() => {
    if (!queue.some(isQueueActive)) return;

    const timerId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [queue]);

  const processingGenerationIds = useMemo(
    () =>
      queue
        .filter((item) => isQueueActive(item) && item.generationId)
        .map((item) => item.generationId as string)
        .sort()
        .join(","),
    [queue]
  );

  useEffect(() => {
    if (!processingGenerationIds) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    async function pollGeneration(generationId: string) {
      let res: Response;
      let data: GenerationStatusResponse & { error?: string };
      try {
        res = await fetch(`/api/generate/${generationId}`, {
          signal: AbortSignal.timeout(10_000),
        });
        data = await res.json();
        if (!res.ok) throw new Error(res.status === 401 ? "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่เพื่อตรวจสอบงาน" : "ตรวจสอบสถานะงานไม่สำเร็จ ระบบจะลองตรวจสอบอีกครั้ง");
      } catch (error) {
        if (!stopped) setQueue((prev) => prev.map((item) => item.generationId === generationId && isQueueActive(item)
          ? { ...item, connectionError: error instanceof Error ? error.message : "ขาดการเชื่อมต่อขณะตรวจสอบสถานะ ระบบจะลองตรวจสอบอีกครั้ง" } : item));
        return;
      }

      if (stopped) return;

      setQueue((prev) => {
        const target = prev.find((item) => item.generationId === generationId);
        if (!target || !isQueueActive(target)) return prev;

        const nextItem = applyGenerationStatus(target, data);
        if (data.status === "success") {
          toast.success(`สร้างรูป ${target.orderNumber} เสร็จแล้ว`);
        } else if (data.status === "failed") {
          toast.error(data.error || `สร้างรูป ${target.orderNumber} ไม่สำเร็จ`);
        }

        return prev.map((item) =>
          item.id === target.id ? nextItem : item
        );
      });
    }

    async function pollAll() {
      const ids = processingGenerationIds.split(",").filter(Boolean);
      await Promise.all(ids.map((id) => pollGeneration(id)));
      if (!stopped) timer = setTimeout(() => { void pollAll(); }, 2500);
    }

    void pollAll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [processingGenerationIds]);

  const submitGeneration = useCallback(async (item: QueueItem) => {
    const queueId = item.id;
    submittedRef.current.add(queueId);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...item.payload, requestId: item.id }),
        signal: AbortSignal.timeout(60_000),
      });
      const data = await res.json();

      if (!res.ok) {
        const completedAt = new Date().toISOString();
        setQueue((prev) =>
          prev.map((entry) =>
            entry.id === queueId
              ? {
                  ...entry,
                  status: "failed",
                  completedAt,
                  error: data.error || "สร้างรูปไม่สำเร็จ",
                }
              : entry
          )
        );
        toast.error(data.error || "สร้างรูปไม่สำเร็จ");
        return;
      }

      setQueue((prev) =>
        prev.map((entry) =>
          entry.id === queueId
            ? {
                ...entry,
                generationId: data.generationId as string,
                status: "pending",
                connectionError: undefined,
              }
            : entry
        )
      );
    } catch (err) {
      const timedOut =
        err instanceof DOMException &&
        (err.name === "TimeoutError" || err.name === "AbortError");
      const message = timedOut
        ? "ส่งคำขอนานเกินไป (เซิร์ฟเวอร์ไม่ตอบสนอง)"
        : "ส่งคำขอสร้างรูปไม่สำเร็จ กรุณาลองใหม่";
      setQueue((prev) =>
        prev.map((entry) =>
          entry.id === queueId
            ? {
                ...entry,
                connectionError: `${message} ระบบอาจรับงานแล้ว กดตรวจสอบคำขอเดิมเพื่อเชื่อมต่ออีกครั้ง`,
              }
            : entry
        )
      );
      toast.error(message);
    } finally {
      submittedRef.current.delete(queueId);
    }
  }, []);

  const enqueueGeneration = useCallback(
    (input: QueueItemInput) => {
      const queueId = crypto.randomUUID();
      const startedAt = new Date().toISOString();
      const queueItem: QueueItem = {
        id: queueId,
        createdAt: startedAt,
        startedAt,
        orderNumber: input.orderNumber,
        userName: input.userName,
        productName: input.productName,
        patternName: input.patternName,
        status: "pending",
        payload: input.payload,
      };

      setQueue((prev) => [queueItem, ...prev]);
      void submitGeneration(queueItem);
      return queueId;
    },
    [submitGeneration]
  );

  const retryGeneration = useCallback(
    (source: QueueItem) => {
      if (queue.some((item) => isQueueActive(item) && item.orderNumber === source.orderNumber)) {
        toast.info("ออเดอร์นี้ยังมีงานที่ไม่เสร็จ กรุณารอหรือยกเลิกงานเดิม");
        return source.id;
      }
      const queueId = crypto.randomUUID();
      const startedAt = new Date().toISOString();
      const queueItem: QueueItem = {
        id: queueId,
        createdAt: startedAt,
        startedAt,
        orderNumber: source.orderNumber,
        userName: source.userName,
        productName: source.productName,
        patternName: source.patternName,
        status: "pending",
        payload: source.payload,
      };

      setQueue((prev) => [queueItem, ...prev]);
      toast.info(`เพิ่ม ${source.orderNumber} ในคิวแล้ว กำลังสร้างรูป...`);
      void submitGeneration(queueItem);
      return queueId;
    },
    [submitGeneration, queue]
  );

  const reconnectGeneration = useCallback((source: QueueItem) => {
    if (!source.generationId && !submittedRef.current.has(source.id)) {
      setQueue((prev) => prev.map((item) => item.id === source.id ? { ...item, connectionError: undefined } : item));
      void submitGeneration(source);
    }
  }, [submitGeneration]);

  const cancelGeneration = useCallback(async (source: QueueItem) => {
    if (!source.generationId || source.cancelling) return;
    setQueue((prev) => prev.map((item) => item.id === source.id ? { ...item, cancelling: true } : item));
    try {
      const res = await fetch(`/api/generate/${source.generationId}`, { method: "DELETE", signal: AbortSignal.timeout(15_000) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ยกเลิกไม่สำเร็จ");
      // The cancellation response confirms the terminal state atomically.
      setQueue((prev) => prev.map((item) => item.id === source.id ? {
        ...item, status: "cancelled", completedAt: data.completedAt,
        warning: undefined, connectionError: undefined, error: "ยกเลิกโดยผู้ใช้",
      } : item));
      toast.info("ยกเลิกงานแล้ว คำขอที่ส่งถึง AI แล้วอาจยังประมวลผลต่อ");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ยกเลิกไม่สำเร็จ");
    } finally {
      setQueue((prev) => prev.map((item) => item.id === source.id ? { ...item, cancelling: false } : item));
    }
  }, []);

  useEffect(() => {
    if (!queueHydrated) return;

    for (const item of queue) {
      if (!isQueueActive(item) || item.generationId || item.connectionError) continue;
      if (submittedRef.current.has(item.id)) continue;
      void submitGeneration(item);
    }
  }, [queueHydrated, queue, submitGeneration]);

  const value = useMemo(
    () => ({
      queue,
      now,
      enqueueGeneration,
      retryGeneration,
      cancelGeneration,
      reconnectGeneration,
    }),
    [queue, now, enqueueGeneration, retryGeneration, cancelGeneration, reconnectGeneration]
  );

  return (
    <GenerateQueueContext.Provider value={value}>
      {children}
    </GenerateQueueContext.Provider>
  );
}
