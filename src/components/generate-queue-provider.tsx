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
  const queueRef = useRef<QueueItem[]>([]);
  const submittedRef = useRef(new Set<string>());

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    setQueue(loadQueueFromStorage());
    setQueueHydrated(true);
  }, []);

  useEffect(() => {
    if (!queueHydrated) return;
    saveQueueToStorage(queue);
  }, [queue, queueHydrated]);

  useEffect(() => {
    if (!queue.some((item) => item.status === "processing")) return;

    const timerId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [queue]);

  const processingGenerationIds = useMemo(
    () =>
      queue
        .filter((item) => item.status === "processing" && item.generationId)
        .map((item) => item.generationId as string)
        .sort()
        .join(","),
    [queue]
  );

  useEffect(() => {
    if (!processingGenerationIds) return;

    async function pollGeneration(generationId: string) {
      const res = await fetch(`/api/generate/${generationId}`);
      const data = (await res.json()) as GenerationStatusResponse & {
        error?: string;
      };

      if (!res.ok) return;

      setQueue((prev) => {
        const target = prev.find((item) => item.generationId === generationId);
        if (!target || target.status !== "processing") return prev;

        if (data.status === "pending") return prev;

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
    }

    void pollAll();
    const intervalId = window.setInterval(() => {
      void pollAll();
    }, 2500);

    return () => window.clearInterval(intervalId);
  }, [processingGenerationIds]);

  const submitGeneration = useCallback(async (queueId: string) => {
    submittedRef.current.add(queueId);
    const item = queueRef.current.find((entry) => entry.id === queueId);
    if (!item) return;

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.payload),
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
                status: "processing",
              }
            : entry
        )
      );
    } catch {
      const completedAt = new Date().toISOString();
      setQueue((prev) =>
        prev.map((entry) =>
          entry.id === queueId
            ? {
                ...entry,
                status: "failed",
                completedAt,
                error: "ส่งคำขอสร้างรูปไม่สำเร็จ กรุณาลองใหม่",
              }
            : entry
        )
      );
      toast.error("ส่งคำขอสร้างรูปไม่สำเร็จ กรุณาลองใหม่");
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
        status: "processing",
        payload: input.payload,
      };

      setQueue((prev) => [queueItem, ...prev]);
      void submitGeneration(queueId);
      return queueId;
    },
    [submitGeneration]
  );

  const retryGeneration = useCallback(
    (source: QueueItem) => {
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
        status: "processing",
        payload: source.payload,
      };

      setQueue((prev) => [queueItem, ...prev]);
      toast.info(`เพิ่ม ${source.orderNumber} ในคิวแล้ว กำลังสร้างรูป...`);
      void submitGeneration(queueId);
      return queueId;
    },
    [submitGeneration]
  );

  useEffect(() => {
    if (!queueHydrated) return;

    for (const item of queue) {
      if (item.status !== "processing" || item.generationId) continue;
      if (submittedRef.current.has(item.id)) continue;
      void submitGeneration(item.id);
    }
  }, [queueHydrated, queue, submitGeneration]);

  const value = useMemo(
    () => ({
      queue,
      now,
      enqueueGeneration,
      retryGeneration,
    }),
    [queue, now, enqueueGeneration, retryGeneration]
  );

  return (
    <GenerateQueueContext.Provider value={value}>
      {children}
    </GenerateQueueContext.Provider>
  );
}
