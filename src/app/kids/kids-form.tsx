"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { resolveImageContentType } from "@/lib/image-content-type";
import { createClient } from "@/lib/supabase/client";
import type { QueuePayload } from "@/lib/generate-queue";
import { findActiveQueueDuplicate, normalizeOrderNumber } from "@/lib/generate-queue";
import { GenerateQueuePanel } from "@/app/generate-queue-panel";
import { useGenerateQueue } from "@/components/generate-queue-provider";
import type { ArtStyle } from "@/types/database";

const STEPS = [
  "เลขออเดอร์",
  "เลือก Art Style",
  "อัปโหลดรูป",
  "สร้างรูป",
  "คิว",
];

interface KidsFormProps {
  initialArtStyles?: ArtStyle[];
  userName?: string;
}

export function KidsForm({
  initialArtStyles = [],
  userName = "-",
}: KidsFormProps) {
  const supabase = useMemo(() => createClient(), []);
  const { queue, now, enqueueGeneration, retryGeneration } = useGenerateQueue();

  const [step, setStep] = useState(0);
  const [orderNumber, setOrderNumber] = useState("");
  const [artStyleId, setArtStyleId] = useState("");
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const artStyles = initialArtStyles;
  const selectedArtStyle = artStyles.find((s) => s.id === artStyleId);

  const queueDuplicate = useMemo(
    () =>
      orderNumber.trim()
        ? findActiveQueueDuplicate(queue, orderNumber)
        : undefined,
    [queue, orderNumber]
  );

  async function handleUpload(file: File) {
    if (!resolveImageContentType(file)) {
      toast.error("รองรับเฉพาะ PNG/jpeg");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("ไฟล์ใหญ่เกิน 10MB");
      return;
    }

    setUploading(true);
    const preview = URL.createObjectURL(file);
    setUploadPreview(preview);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();

    if (res.ok) {
      setUploadedImageUrl(data.url);
      toast.success("อัปโหลดรูปสำเร็จ");
    } else {
      setUploadPreview(null);
      toast.error(data.error || "อัปโหลดไม่สำเร็จ");
    }
    setUploading(false);
  }

  function resetFormForNewGeneration() {
    setOrderNumber("");
    setArtStyleId("");
    setUploadedImageUrl(null);
    setUploadPreview(null);
    setStep(0);
  }

  async function handleGenerate() {
    const trimmedOrder = orderNumber.trim();
    if (!trimmedOrder) {
      toast.error("กรุณากรอกเลขออเดอร์");
      return;
    }

    if (!artStyleId) {
      toast.error("กรุณาเลือก Art Style");
      return;
    }

    if (!uploadedImageUrl) {
      toast.error("กรุณาอัปโหลดรูป");
      return;
    }

    const sanitizedOrder = normalizeOrderNumber(trimmedOrder);
    if (!sanitizedOrder) {
      toast.error("เลขออเดอร์ไม่ถูกต้อง");
      return;
    }

    const duplicateInQueue = findActiveQueueDuplicate(queue, trimmedOrder);
    if (duplicateInQueue) {
      toast.error(
        `เลขออเดอร์ "${trimmedOrder}" มีในคิวแล้ว — ใช้เลขอื่นหรือกด "สร้างซ้ำ" จากรายการเดิม`
      );
      return;
    }

    const { data: activeInDb } = await supabase
      .from("generations")
      .select("id")
      .eq("order_number", sanitizedOrder)
      .in("status", ["pending", "processing"])
      .limit(1);

    if (activeInDb && activeInDb.length > 0) {
      toast.error(
        `เลขออเดอร์ "${trimmedOrder}" กำลังสร้างอยู่ในระบบ กรุณารอให้เสร็จหรือใช้เลขอื่น`
      );
      return;
    }

    const payload: QueuePayload = {
      artStyleId,
      orderNumber: trimmedOrder,
      texts: [],
      uploadedImageUrl,
    };

    enqueueGeneration({
      orderNumber: trimmedOrder,
      userName,
      productName: "หน้าเด็ก",
      patternName: selectedArtStyle?.name ?? "-",
      payload,
    });

    toast.info("เพิ่มในคิวแล้ว สามารถสร้างรายการใหม่หรือไปหน้าอื่นได้");
    resetFormForNewGeneration();
  }

  return (
    <div className="generate-page">
      <div className="generate-hero">
        <h1 className="page-title !mb-2">หน้าเด็ก</h1>
        <p className="text-base text-muted-foreground sm:text-lg">
          เลือก Art Style อัปโหลดรูป แล้วสร้างภาพ PNG คุณภาพสูง
        </p>
      </div>

      <div className="generate-steps">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(i)}
            className={`rounded-full px-4 py-2 text-sm sm:text-base transition-colors ${
              step === i ? "step-pill-active" : "step-pill-inactive"
            }`}
          >
            {i + 1}. {label}
            {i === STEPS.length - 1 && queue.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-semibold text-accent-foreground">
                {queue.filter((q) => q.status === "processing").length || queue.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <Card className="generate-card">
        <CardHeader className="text-center">
          <CardTitle className="text-xl sm:text-2xl">{STEPS[step]}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {step === 0 && (
            <>
              <div className="mx-auto w-full max-w-md space-y-2">
                <Label htmlFor="kids-order-number">เลขออเดอร์</Label>
                <Input
                  id="kids-order-number"
                  className="h-11"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="เช่น ORD-2024-001"
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground">
                  ใช้ตั้งชื่อไฟล์รูปเมื่อสร้างเสร็จ (เช่น ORD-2024-001.png)
                </p>
              </div>
              {queueDuplicate && (
                <Alert variant="destructive" className="mx-auto max-w-md">
                  <AlertDescription>
                    เลขออเดอร์ &quot;{orderNumber.trim()}&quot; มีในคิวแล้ว
                    {queueDuplicate.status === "processing"
                      ? " (กำลังสร้าง)"
                      : " (สร้างเสร็จแล้ว)"}{" "}
                    — ใช้เลขอื่นหรือกด &quot;สร้างซ้ำ&quot; จากรายการเดิม
                  </AlertDescription>
                </Alert>
              )}
              <div className="generate-actions">
                <Button
                  onClick={() => setStep(1)}
                  disabled={!orderNumber.trim() || !!queueDuplicate}
                  className="min-w-32"
                >
                  ถัดไป
                </Button>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              {artStyles.length === 0 ? (
                <p className="text-muted-foreground">
                  ยังไม่มี Art Style — ติดต่อผู้ดูแล
                </p>
              ) : (
                <div className="mx-auto grid w-full max-w-2xl grid-cols-3 gap-3">
                  {artStyles.map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setArtStyleId(style.id)}
                      className={`rounded-xl border p-3 text-left transition-all ${
                        artStyleId === style.id
                          ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/20"
                          : "border-border hover:border-accent/50 hover:bg-secondary/50"
                      }`}
                    >
                      {style.thumbnail_url ? (
                        <div className="mb-3 flex h-36 items-center justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={style.thumbnail_url}
                            alt={style.name}
                            className="max-h-36 max-w-full rounded-lg object-contain"
                          />
                        </div>
                      ) : (
                        <div className="mb-3 flex h-36 items-center justify-center rounded-lg bg-muted/50 text-xs text-muted-foreground">
                          ไม่มีรูป
                        </div>
                      )}
                      <p className="font-medium">{style.name}</p>
                    </button>
                  ))}
                </div>
              )}
              <div className="generate-actions">
                <Button variant="outline" onClick={() => setStep(0)}>
                  ย้อนกลับ
                </Button>
                <Button onClick={() => setStep(2)} disabled={!artStyleId} className="min-w-32">
                  ถัดไป
                </Button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="mx-auto w-full max-w-md space-y-4">
                <div className="space-y-2">
                  <Label>อัปโหลดรูปเด็ก (PNG/JPEG สูงสุด 10MB)</Label>
                  <Input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="h-11"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(file);
                    }}
                    disabled={uploading}
                  />
                </div>
                {uploadPreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={uploadPreview}
                    alt="preview"
                    className="mx-auto max-h-48 rounded-md border"
                  />
                )}
              </div>
              <div className="generate-actions">
                <Button variant="outline" onClick={() => setStep(1)}>
                  ย้อนกลับ
                </Button>
                <Button onClick={() => setStep(3)} disabled={!uploadedImageUrl} className="min-w-32">
                  ถัดไป
                </Button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="mx-auto w-full max-w-md space-y-4">
                <div className="rounded-xl bg-muted/80 p-4 text-base">
                  <p>
                    <strong>ผู้สร้าง:</strong> {userName}
                  </p>
                  <p>
                    <strong>เลขออเดอร์:</strong> {orderNumber.trim()}
                  </p>
                  <p>
                    <strong>ชื่อไฟล์:</strong> {orderNumber.trim()}.png
                  </p>
                  <p>
                    <strong>Art Style:</strong> {selectedArtStyle?.name}
                  </p>
                </div>
                {queueDuplicate && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      เลขออเดอร์ &quot;{orderNumber.trim()}&quot; มีในคิวแล้ว
                      {queueDuplicate.status === "processing"
                        ? " (กำลังสร้าง)"
                        : " (สร้างเสร็จแล้ว)"}{" "}
                      — ใช้เลขอื่นหรือกด &quot;สร้างซ้ำ&quot; จากรายการเดิม
                    </AlertDescription>
                  </Alert>
                )}
                <Button
                  size="lg"
                  className="h-12 w-full text-base"
                  onClick={handleGenerate}
                  disabled={!!queueDuplicate}
                >
                  สร้างรูป
                </Button>
              </div>
              <div className="generate-actions">
                <Button variant="outline" onClick={() => setStep(2)}>
                  ย้อนกลับ
                </Button>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <GenerateQueuePanel
                queue={queue}
                now={now}
                onRetry={retryGeneration}
              />
              <div className="generate-actions">
                <Button variant="outline" onClick={() => setStep(3)}>
                  กลับ
                </Button>
                <Button onClick={() => setStep(0)} className="min-w-32">
                  สร้างรูปใหม่
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
