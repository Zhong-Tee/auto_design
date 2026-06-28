"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildOutputFileName } from "@/lib/order-filename";
import { cn } from "@/lib/utils";
import type { Generation } from "@/types/database";
import { deleteGenerations } from "./actions";

interface HistoryPanelProps {
  items: Generation[];
  profileLabels: Record<string, string>;
}

const NO_FILENAME_LABEL = "ไม่มีชื่อไฟล์";

function getOrderLabel(orderNumber: string | null | undefined): string {
  const trimmed = orderNumber?.trim();
  return trimmed || NO_FILENAME_LABEL;
}

function getItemLabel(item: Generation): string {
  return getOrderLabel(item.order_number);
}

export function HistoryPanel({ items, profileLabels }: HistoryPanelProps) {
  const router = useRouter();
  const [generations, setGenerations] = useState(items);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setGenerations(items);
  }, [items]);

  const selectedCount = selectedIds.size;
  const allSelected =
    generations.length > 0 && selectedCount === generations.length;

  const selectedPreview = useMemo(
    () =>
      generations
        .filter((item) => selectedIds.has(item.id))
        .slice(0, 5),
    [generations, selectedIds]
  );

  function exitDeleteMode() {
    setDeleteMode(false);
    setSelectedIds(new Set());
    setConfirmOpen(false);
  }

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(generations.map((item) => item.id)));
  }

  function handleConfirmDelete() {
    const ids = [...selectedIds];
    startTransition(async () => {
      try {
        const result = await deleteGenerations(ids);
        setGenerations((prev) => prev.filter((item) => !selectedIds.has(item.id)));
        toast.success(`ลบ ${result.deleted} รายการแล้ว`);
        exitDeleteMode();
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "ลบไม่สำเร็จ");
      }
    });
  }

  return (
    <div className="page-container-wide">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title !mb-0">ประวัติการสร้างรูป</h1>
        {generations.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {deleteMode && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toggleSelectAll}
              >
                {allSelected ? "ยกเลิกเลือกทั้งหมด" : "เลือกทั้งหมด"}
              </Button>
            )}
            {deleteMode ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={exitDeleteMode}
                  disabled={pending}
                >
                  ยกเลิก
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={selectedCount === 0 || pending}
                  onClick={() => setConfirmOpen(true)}
                >
                  ลบ{selectedCount > 0 ? ` (${selectedCount})` : ""}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeleteMode(true)}
              >
                ลบ
              </Button>
            )}
          </div>
        )}
      </div>

      {deleteMode && (
        <p className="mb-4 text-sm text-muted-foreground">
          เลือกรายการที่ต้องการลบ แล้วกดปุ่ม &quot;ลบ&quot; เพื่อยืนยัน
        </p>
      )}

      {generations.length === 0 ? (
        <p className="text-muted-foreground">ยังไม่มีประวัติการสร้างรูป</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
          {generations.map((gen) => {
            const outputFileName = gen.order_number
              ? buildOutputFileName(gen.order_number)
              : null;
            const userName = profileLabels[gen.user_id] ?? "-";
            const isSelected = selectedIds.has(gen.id);

            return (
              <Card
                key={gen.id}
                className={cn(
                  "overflow-hidden transition-shadow",
                  deleteMode && "cursor-pointer",
                  isSelected && "ring-2 ring-destructive"
                )}
                onClick={
                  deleteMode
                    ? () => toggleSelection(gen.id)
                    : undefined
                }
              >
                <CardHeader className="space-y-1 p-3 pb-2">
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex min-w-0 items-start gap-2">
                      {deleteMode && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          aria-label={`เลือก ${getItemLabel(gen)}`}
                          className="mt-0.5 size-4 shrink-0 accent-destructive"
                          onClick={(event) => event.stopPropagation()}
                          onChange={() => toggleSelection(gen.id)}
                        />
                      )}
                      <CardTitle className="text-xs font-medium leading-snug">
                        {getOrderLabel(gen.order_number)}
                      </CardTitle>
                    </div>
                    <Badge
                      className="shrink-0 text-[10px]"
                      variant={
                        gen.status === "success"
                          ? "default"
                          : gen.status === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {gen.status === "success"
                        ? "สำเร็จ"
                        : gen.status === "failed"
                          ? "ล้มเหลว"
                          : "รอดำเนินการ"}
                    </Badge>
                  </div>
                  <div className="space-y-0.5 text-sm leading-snug text-muted-foreground">
                    <p>ผู้สร้าง: {userName}</p>
                    <p>{new Date(gen.created_at).toLocaleString("th-TH")}</p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 p-3 pt-0">
                  {gen.output_image_url ? (
                    <div className="flex h-36 items-center justify-center rounded-md border bg-muted/30 p-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={gen.output_image_url}
                        alt={gen.order_number ?? "ผลลัพธ์"}
                        className="max-h-full max-w-full rounded object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex h-36 items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground">
                      {gen.error_message || "ไม่มีรูป"}
                    </div>
                  )}
                  <p className="text-xs">
                    Token: {gen.total_tokens.toLocaleString()} ·{" "}
                    <span className="font-semibold">
                      {Number(gen.cost_thb).toFixed(2)} บาท
                    </span>
                  </p>
                  {!deleteMode && gen.output_image_url && (
                    <a
                      href={gen.output_image_url}
                      download={outputFileName ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonVariants({
                        size: "sm",
                        variant: "default",
                        className: "h-8 w-full text-xs",
                      })}
                    >
                      ดาวน์โหลด PNG
                    </a>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ยืนยันการลบ</DialogTitle>
            <DialogDescription>
              ต้องการลบ {selectedCount} รายการหรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
            </DialogDescription>
          </DialogHeader>
          {selectedPreview.length > 0 && (
            <ul className="max-h-32 list-inside list-disc overflow-y-auto text-sm text-muted-foreground">
              {selectedPreview.map((item) => (
                <li key={item.id}>{getItemLabel(item)}</li>
              ))}
              {selectedCount > selectedPreview.length && (
                <li>และอีก {selectedCount - selectedPreview.length} รายการ</li>
              )}
            </ul>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setConfirmOpen(false)}
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={handleConfirmDelete}
            >
              {pending ? "กำลังลบ..." : "ยืนยันลบ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
