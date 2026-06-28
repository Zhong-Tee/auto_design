"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { resolveImageContentType } from "@/lib/image-content-type";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import {
  formatQualityLabel,
  formatSize,
  getShapeSizeErrors,
  isExperimentalResolution,
  isValidShapeSize,
} from "@/lib/shapes";
import type {
  GenerationResult,
  Pattern,
  Product,
  Shape,
  TextBoxConfig,
  TokenUsage,
} from "@/types/database";

const STEPS = [
  "เลขออเดอร์",
  "เลือกสินค้า",
  "เลือกรูปแบบ",
  "เลือกรูปทรง",
  "กรอกข้อความ",
  "อัปโหลดรูป",
  "สร้างรูป",
  "คิว",
];

type QueueItemStatus = "processing" | "success" | "failed";

interface QueueItem {
  id: string;
  createdAt: string;
  orderNumber: string;
  userName: string;
  productName: string;
  patternName: string;
  shapeLabel: string;
  status: QueueItemStatus;
  result?: GenerationResult & { usage: TokenUsage };
  error?: string;
}

interface GenerateFormProps {
  initialProducts?: Product[];
  initialShapes?: Shape[];
  userName?: string;
}

export function GenerateForm({
  initialProducts = [],
  initialShapes = [],
  userName = "-",
}: GenerateFormProps) {
  const supabase = useMemo(() => createClient(), []);
  const hasInitialData = initialProducts.length > 0 || initialShapes.length > 0;

  const [loading, setLoading] = useState(!hasInitialData);
  const [step, setStep] = useState(0);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [orderNumber, setOrderNumber] = useState("");

  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [shapes, setShapes] = useState<Shape[]>(initialShapes);
  const [textBoxConfigs, setTextBoxConfigs] = useState<TextBoxConfig[]>([]);

  const [productId, setProductId] = useState("");
  const [patternId, setPatternId] = useState("");
  const [shapeId, setShapeId] = useState("");
  const [texts, setTexts] = useState<string[]>([]);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const selectedProduct = products.find((p) => p.id === productId);
  const selectedPattern = patterns.find((p) => p.id === patternId);
  const selectedShape = shapes.find((s) => s.id === shapeId);

  const loadMasterData = useCallback(async () => {
    setLoading(true);
    const [productsRes, shapesRes] = await Promise.all([
      supabase.from("products").select("*").eq("is_active", true).order("name"),
      supabase.from("shapes").select("*").eq("is_active", true).order("name"),
    ]);

    setProducts(productsRes.data ?? []);
    setShapes(shapesRes.data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    setProducts(initialProducts);
    setShapes(initialShapes);
    if (initialProducts.length > 0 || initialShapes.length > 0) {
      setLoading(false);
    }
  }, [initialProducts, initialShapes]);

  useEffect(() => {
    if (hasInitialData) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch master data on mount
    void loadMasterData();
  }, [hasInitialData, loadMasterData]);

  useEffect(() => {
    if (!productId) {
      setPatterns([]);
      return;
    }

    let cancelled = false;

    async function load() {
      const product = products.find((p) => p.id === productId);
      const count = product?.text_box_count ?? 1;

      const [patternsRes, textBoxRes] = await Promise.all([
        supabase
          .from("patterns")
          .select("*")
          .eq("product_id", productId)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("text_box_configs")
          .select("*")
          .eq("product_id", productId)
          .order("position"),
      ]);

      if (cancelled) return;

      setPatterns(patternsRes.data ?? []);
      setPatternId("");
      setTextBoxConfigs(textBoxRes.data ?? []);
      setTexts(Array.from({ length: count }, () => ""));
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [productId, products, supabase]);

  useEffect(() => {
    if (step !== 2 || !productId || patterns.length > 0) return;

    let cancelled = false;

    async function reload() {
      const { data } = await supabase
        .from("patterns")
        .select("*")
        .eq("product_id", productId)
        .eq("is_active", true)
        .order("name");

      if (cancelled) return;
      setPatterns(data ?? []);
    }

    void reload();

    return () => {
      cancelled = true;
    };
  }, [step, productId, patterns.length, supabase]);

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

  async function handleGenerate() {
    const trimmedOrder = orderNumber.trim();
    if (!trimmedOrder) {
      toast.error("กรุณากรอกเลขออเดอร์");
      return;
    }

    if (!productId || !patternId || !shapeId) {
      toast.error("กรุณาเลือกข้อมูลให้ครบ");
      return;
    }

    if (selectedPattern?.requires_image && !uploadedImageUrl) {
      toast.error("กรุณาอัปโหลดรูปคน");
      return;
    }

    const queueId = crypto.randomUUID();
    const queueItem: QueueItem = {
      id: queueId,
      createdAt: new Date().toISOString(),
      orderNumber: trimmedOrder,
      userName,
      productName: selectedProduct?.name ?? "-",
      patternName: selectedPattern?.name ?? "-",
      shapeLabel: selectedShape
        ? `${selectedShape.name} (${formatSize(selectedShape.width_px, selectedShape.height_px)})`
        : "-",
      status: "processing",
    };

    setQueue((prev) => [queueItem, ...prev]);
    setStep(7);
    toast.info("เพิ่มในคิวแล้ว กำลังสร้างรูป...");

    const payload = {
      productId,
      patternId,
      shapeId,
      orderNumber: trimmedOrder,
      texts,
      uploadedImageUrl,
    };

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        setQueue((prev) =>
          prev.map((item) =>
            item.id === queueId
              ? { ...item, status: "success", result: data }
              : item
          )
        );
        toast.success("สร้างรูปสำเร็จ");
      } else {
        setQueue((prev) =>
          prev.map((item) =>
            item.id === queueId
              ? {
                  ...item,
                  status: "failed",
                  error: data.error || "สร้างรูปไม่สำเร็จ",
                }
              : item
          )
        );
        toast.error(data.error || "สร้างรูปไม่สำเร็จ");
      }
    } catch {
      setQueue((prev) =>
        prev.map((item) =>
          item.id === queueId
            ? { ...item, status: "failed", error: "สร้างรูปไม่สำเร็จ กรุณาลองใหม่" }
            : item
        )
      );
      toast.error("สร้างรูปไม่สำเร็จ กรุณาลองใหม่");
    }
  }

  function getQueueStatusLabel(status: QueueItemStatus) {
    if (status === "processing") return "กำลังสร้าง";
    if (status === "success") return "สำเร็จ";
    return "ล้มเหลว";
  }

  function getQueueStatusVariant(status: QueueItemStatus) {
    if (status === "success") return "default" as const;
    if (status === "failed") return "destructive" as const;
    return "secondary" as const;
  }

  function getTextBoxLabel(index: number) {
    const cfg = textBoxConfigs.find((c) => c.position === index + 1);
    return cfg?.label || `ข้อความ ${index + 1}`;
  }

  function getTextBoxPlaceholder(index: number) {
    const cfg = textBoxConfigs.find((c) => c.position === index + 1);
    return cfg?.placeholder || "";
  }

  function getTextBoxMaxLength(index: number) {
    const cfg = textBoxConfigs.find((c) => c.position === index + 1);
    return cfg?.max_length ?? undefined;
  }

  if (loading) {
    return (
      <div className="generate-page">
        <div className="generate-hero">
          <Skeleton className="mx-auto h-10 w-56" />
          <Skeleton className="mx-auto mt-3 h-5 w-72" />
        </div>
        <Skeleton className="generate-card h-64 w-full max-w-2xl rounded-xl" />
      </div>
    );
  }

  return (
    <div className="generate-page">
      <div className="generate-hero">
        <h1 className="page-title !mb-2">สร้างรูป AI</h1>
        <p className="text-base text-muted-foreground sm:text-lg">
          เลือกสินค้า รูปแบบ และรูปทรง แล้วสร้างภาพ PNG คุณภาพสูง
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
            {i === 7 && queue.length > 0 && (
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
                <Label htmlFor="order-number">เลขออเดอร์</Label>
                <Input
                  id="order-number"
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
              <div className="generate-actions">
                <Button
                  onClick={() => setStep(1)}
                  disabled={!orderNumber.trim()}
                  className="min-w-32"
                >
                  ถัดไป
                </Button>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              {products.length === 0 ? (
                <p className="text-muted-foreground">ยังไม่มีสินค้า — ติดต่อผู้ดูแล</p>
              ) : (
                <div className="mx-auto grid w-full grid-cols-4 gap-3">
                  {products.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => {
                        setProductId(product.id);
                        setPatternId("");
                      }}
                      className={`rounded-xl border p-3 text-left transition-all ${
                        productId === product.id
                          ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/20"
                          : "border-border hover:border-accent/50 hover:bg-secondary/50"
                      }`}
                    >
                      {product.image_url ? (
                        <div className="mb-3 flex h-28 items-center justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="max-h-28 max-w-full rounded-lg object-contain"
                          />
                        </div>
                      ) : (
                        <div className="mb-3 flex h-28 items-center justify-center rounded-lg bg-muted/50 text-xs text-muted-foreground">
                          ไม่มีรูป
                        </div>
                      )}
                      <p className="font-medium leading-snug">{product.name}</p>
                      {product.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {product.description}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <div className="generate-actions">
                <Button variant="outline" onClick={() => setStep(0)}>
                  ย้อนกลับ
                </Button>
                <Button onClick={() => setStep(2)} disabled={!productId} className="min-w-32">
                  ถัดไป
                </Button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              {patterns.length === 0 ? (
                <p className="text-muted-foreground">ไม่มีรูปแบบสำหรับสินค้านี้</p>
              ) : (
                <div className="mx-auto grid w-full max-w-2xl grid-cols-3 gap-3">
                  {patterns.map((pattern) => (
                    <button
                      key={pattern.id}
                      type="button"
                      onClick={() => setPatternId(pattern.id)}
                      className={`rounded-xl border p-3 text-left transition-all ${
                        patternId === pattern.id
                          ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/20"
                          : "border-border hover:border-accent/50 hover:bg-secondary/50"
                      }`}
                    >
                      {pattern.thumbnail_url && (
                        <div className="mb-3 flex h-36 items-center justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={pattern.thumbnail_url}
                            alt={pattern.name}
                            className="max-h-36 max-w-full rounded-lg object-contain"
                          />
                        </div>
                      )}
                      <p className="font-medium">{pattern.name}</p>
                      {pattern.requires_image && (
                        <p className="text-xs text-muted-foreground">
                          ต้องอัปโหลดรูป
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <div className="generate-actions">
                <Button variant="outline" onClick={() => setStep(1)}>
                  ย้อนกลับ
                </Button>
                <Button onClick={() => setStep(3)} disabled={!patternId} className="min-w-32">
                  ถัดไป
                </Button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              {shapes.length === 0 ? (
                <p className="text-muted-foreground">ยังไม่มีรูปทรง</p>
              ) : (
                <div className="mx-auto w-full max-w-md space-y-2">
                  <Label>รูปทรง / ความละเอียด</Label>
                  <Select value={shapeId} onValueChange={(v) => setShapeId(v ?? "")}>
                    <SelectTrigger className="h-11 w-full">
                      <SelectValue placeholder="เลือกรูปทรง">
                        {selectedShape
                          ? `${selectedShape.name} — ${formatSize(selectedShape.width_px, selectedShape.height_px)}`
                          : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {shapes.map((shape) => (
                        <SelectItem key={shape.id} value={shape.id}>
                          {shape.name} — {formatSize(shape.width_px, shape.height_px)} —{" "}
                          {formatQualityLabel(shape.quality)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {selectedShape &&
                getShapeSizeErrors(
                  selectedShape.width_px,
                  selectedShape.height_px
                ).map((message) => (
                  <Alert key={message} variant="destructive">
                    <AlertDescription>{message}</AlertDescription>
                  </Alert>
                ))}
              {selectedShape &&
                isValidShapeSize(selectedShape.width_px, selectedShape.height_px) &&
                isExperimentalResolution(
                  selectedShape.width_px,
                  selectedShape.height_px
                ) && (
                  <Alert>
                    <AlertDescription>
                      ความละเอียดเกิน 2K — อาจมีผลลัพธ์ไม่แน่นอน
                    </AlertDescription>
                  </Alert>
                )}
              <div className="generate-actions">
                <Button variant="outline" onClick={() => setStep(2)}>
                  ย้อนกลับ
                </Button>
                <Button
                  onClick={() => setStep(4)}
                  disabled={
                    !shapeId ||
                    (selectedShape
                      ? getShapeSizeErrors(
                          selectedShape.width_px,
                          selectedShape.height_px
                        ).length > 0
                      : false)
                  }
                  className="min-w-32"
                >
                  ถัดไป
                </Button>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div className="mx-auto w-full max-w-md space-y-4">
              {texts.map((text, index) => (
                <div key={index} className="space-y-2">
                  <Label>{getTextBoxLabel(index)}</Label>
                  <Input
                    className="h-11"
                    value={text}
                    onChange={(e) => {
                      const next = [...texts];
                      next[index] = e.target.value;
                      setTexts(next);
                    }}
                    placeholder={getTextBoxPlaceholder(index)}
                    maxLength={getTextBoxMaxLength(index)}
                  />
                </div>
              ))}
              </div>
              <div className="generate-actions">
                <Button variant="outline" onClick={() => setStep(3)}>
                  ย้อนกลับ
                </Button>
                <Button
                  onClick={() =>
                    setStep(selectedPattern?.requires_image ? 5 : 6)
                  }
                  className="min-w-32"
                >
                  ถัดไป
                </Button>
              </div>
            </>
          )}

          {step === 5 && selectedPattern?.requires_image && (
            <>
              <div className="mx-auto w-full max-w-md space-y-4">
                <div className="space-y-2">
                  <Label>อัปโหลดรูปคน (PNG/JPEG สูงสุด 10MB)</Label>
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
                <Button variant="outline" onClick={() => setStep(4)}>
                  ย้อนกลับ
                </Button>
                <Button onClick={() => setStep(6)} disabled={!uploadedImageUrl} className="min-w-32">
                  ถัดไป
                </Button>
              </div>
            </>
          )}

          {step === 6 && (
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
                  <strong>สินค้า:</strong> {selectedProduct?.name}
                </p>
                <p>
                  <strong>รูปแบบ:</strong> {selectedPattern?.name}
                </p>
                <p>
                  <strong>รูปทรง:</strong>{" "}
                  {selectedShape
                    ? `${selectedShape.name} (${formatSize(selectedShape.width_px, selectedShape.height_px)})`
                    : "-"}
                </p>
              </div>
              <Button
                size="lg"
                className="h-12 w-full text-base"
                onClick={handleGenerate}
              >
                สร้างรูป
              </Button>
              </div>
              <div className="generate-actions">
              {!selectedPattern?.requires_image && (
                <Button variant="outline" onClick={() => setStep(4)}>
                  ย้อนกลับ
                </Button>
              )}
              {selectedPattern?.requires_image && (
                <Button variant="outline" onClick={() => setStep(5)}>
                  ย้อนกลับ
                </Button>
              )}
              </div>
            </>
          )}

          {step === 7 && (
            <>
              {queue.length === 0 ? (
                <p className="text-center text-muted-foreground">
                  ยังไม่มีรายการในคิว — กด &quot;สร้างรูป&quot; ที่ขั้นตอนที่ 6
                  เพื่อเพิ่มรายการ
                </p>
              ) : (
                <div className="space-y-4">
                  {queue.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border bg-muted/30 p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-muted-foreground">
                          {new Date(item.createdAt).toLocaleString("th-TH")}
                        </p>
                        <Badge variant={getQueueStatusVariant(item.status)}>
                          {getQueueStatusLabel(item.status)}
                        </Badge>
                      </div>
                      <div className="text-sm">
                        <p>
                          <strong>ผู้สร้าง:</strong> {item.userName}
                        </p>
                        <p>
                          <strong>เลขออเดอร์:</strong> {item.orderNumber}
                        </p>
                        <p>
                          <strong>ชื่อไฟล์:</strong>{" "}
                          {item.result?.outputFileName ?? `${item.orderNumber}.png`}
                        </p>
                        <p>
                          <strong>สินค้า:</strong> {item.productName}
                        </p>
                        <p>
                          <strong>รูปแบบ:</strong> {item.patternName}
                        </p>
                        <p>
                          <strong>รูปทรง:</strong> {item.shapeLabel}
                        </p>
                      </div>

                      {item.status === "processing" && (
                        <div className="flex h-40 items-center justify-center rounded-lg border bg-muted/50">
                          <p className="text-sm text-muted-foreground animate-pulse">
                            กำลังสร้างรูป...
                          </p>
                        </div>
                      )}

                      {item.status === "failed" && (
                        <div className="flex h-24 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 px-4 text-center text-sm text-destructive">
                          {item.error || "สร้างรูปไม่สำเร็จ"}
                        </div>
                      )}

                      {item.status === "success" && item.result && (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.result.outputImageUrl}
                            alt="ผลลัพธ์"
                            className="mx-auto max-h-64 rounded-lg border"
                          />
                          <div className="generate-actions">
                            <a
                              href={item.result.outputImageUrl}
                              download={
                                item.result.outputFileName ??
                                `${item.orderNumber}.png`
                              }
                              target="_blank"
                              rel="noreferrer"
                              className={buttonVariants({ size: "sm" })}
                            >
                              ดาวน์โหลด {item.result.outputFileName ?? `${item.orderNumber}.png`}
                            </a>
                          </div>
                          <div className="rounded-xl border bg-muted/50 p-3 text-sm">
                            <p>
                              Token รวม:{" "}
                              {item.result.usage.total_tokens.toLocaleString()}
                            </p>
                            <p className="mt-1 font-semibold">
                              ค่าใช้จ่าย: {item.result.costThbDisplay} บาท
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="generate-actions">
                <Button variant="outline" onClick={() => setStep(6)}>
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
