"use client";

import { useState } from "react";
import { Loader2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatElapsed,
  getQueueElapsedMs,
  getQueueStatusLabel,
  getQueueStatusVariant,
  groupQueueByDay,
  type QueueItem,
} from "@/lib/generate-queue";

interface GenerateQueuePanelProps {
  queue: QueueItem[];
  now: number;
  onRetry: (item: QueueItem) => void;
}

export function GenerateQueuePanel({
  queue,
  now,
  onRetry,
}: GenerateQueuePanelProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const groupedQueue = groupQueueByDay(queue);

  if (queue.length === 0) {
    return (
      <p className="text-center text-muted-foreground">
        ยังไม่มีรายการในคิว — กด &quot;สร้างรูป&quot; ที่ขั้นตอนที่ 6
        เพื่อเพิ่มรายการ
      </p>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {groupedQueue.map((group) => (
          <section key={group.label} className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">
              {group.label}
            </h3>
            <div className="overflow-hidden rounded-xl border">
              {group.items.map((item, index) => {
                const elapsed = formatElapsed(getQueueElapsedMs(item, now));
                const outputFileName =
                  item.result?.outputFileName ?? `${item.orderNumber}.png`;

                return (
                  <div
                    key={item.id}
                    className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 sm:flex-nowrap ${
                      index > 0 ? "border-t" : ""
                    }`}
                  >
                    <div className="shrink-0">
                      {item.status === "success" && item.result ? (
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewUrl(item.result!.outputImageUrl)
                          }
                          className="block overflow-hidden rounded-md border transition hover:opacity-90"
                          aria-label={`ดูรูป ${item.orderNumber}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.result.outputImageUrl}
                            alt={item.orderNumber}
                            className="size-14 object-cover"
                          />
                        </button>
                      ) : (
                        <div className="flex size-14 items-center justify-center rounded-md border bg-muted/40">
                          {item.status === "processing" ? (
                            <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {item.status === "failed" ? "!" : "-"}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                      <p className="truncate font-medium">{item.orderNumber}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.productName} · {item.patternName}
                      </p>
                      {item.status === "failed" && item.error && (
                        <p className="mt-0.5 truncate text-xs text-destructive">
                          {item.error}
                        </p>
                      )}
                    </div>

                    <div className="hidden shrink-0 text-sm tabular-nums text-muted-foreground md:block">
                      {elapsed}
                    </div>

                    <div className="shrink-0 text-right text-sm tabular-nums">
                      <p className="text-[11px] text-muted-foreground">Token</p>
                      <p className="font-medium">
                        {item.status === "success" && item.result
                          ? item.result.usage.total_tokens.toLocaleString()
                          : "—"}
                      </p>
                    </div>

                    <div className="shrink-0 text-right text-sm tabular-nums">
                      <p className="text-[11px] text-muted-foreground">บาท</p>
                      <p className="font-medium">
                        {item.status === "success" && item.result
                          ? item.result.costThbDisplay
                          : "—"}
                      </p>
                    </div>

                    <div className="shrink-0 text-sm tabular-nums text-muted-foreground md:hidden">
                      {elapsed}
                    </div>

                    <Badge
                      variant={getQueueStatusVariant(item.status)}
                      className="shrink-0"
                    >
                      {getQueueStatusLabel(item.status)}
                    </Badge>

                    <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onRetry(item)}
                      >
                        สร้างซ้ำ
                      </Button>
                      {item.status === "success" && item.result && (
                        <a
                          href={item.result.outputImageUrl}
                          download={outputFileName}
                          target="_blank"
                          rel="noreferrer"
                          className={buttonVariants({ variant: "outline", size: "sm" })}
                        >
                          ดาวน์โหลด
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>ดูรูปเต็ม</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="รูปเต็ม"
              className="mx-auto max-h-[70vh] w-full rounded-lg object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
