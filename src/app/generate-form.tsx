"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  isExperimentalResolution,
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
  "เลือกสินค้า",
  "เลือกรูปแบบ",
  "เลือกรูปทรง",
  "กรอกข้อความ",
  "อัปโหลดรูป",
  "สร้างรูป",
];

interface GenerateFormProps {
  initialProducts?: Product[];
  initialShapes?: Shape[];
}

export function GenerateForm({
  initialProducts = [],
  initialShapes = [],
}: GenerateFormProps) {
  const supabase = useMemo(() => createClient(), []);
  const hasInitialData = initialProducts.length > 0 || initialShapes.length > 0;

  const [loading, setLoading] = useState(!hasInitialData);
  const [generating, setGenerating] = useState(false);
  const [step, setStep] = useState(0);

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

  const [result, setResult] = useState<
    (GenerationResult & { usage: TokenUsage }) | null
  >(null);

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
      return;
    }

    let cancelled = false;

    async function loadPatterns() {
      const { data } = await supabase
        .from("patterns")
        .select("*")
        .eq("product_id", productId)
        .eq("is_active", true)
        .order("name");

      if (cancelled) return;
      setPatterns(data ?? []);
      setPatternId("");
    }

    async function loadTextBoxConfigs() {
      const product = products.find((p) => p.id === productId);
      const count = product?.text_box_count ?? 1;

      const { data } = await supabase
        .from("text_box_configs")
        .select("*")
        .eq("product_id", productId)
        .order("position");

      if (cancelled) return;
      setTextBoxConfigs(data ?? []);
      setTexts(Array.from({ length: count }, () => ""));
    }

    void loadPatterns();
    void loadTextBoxConfigs();

    return () => {
      cancelled = true;
    };
  }, [productId, products, supabase]);

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
    if (!productId || !patternId || !shapeId) {
      toast.error("กรุณาเลือกข้อมูลให้ครบ");
      return;
    }

    if (selectedPattern?.requires_image && !uploadedImageUrl) {
      toast.error("กรุณาอัปโหลดรูปคน");
      return;
    }

    setGenerating(true);
    setResult(null);

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        patternId,
        shapeId,
        texts,
        uploadedImageUrl,
      }),
    });

    const data = await res.json();
    setGenerating(false);

    if (res.ok) {
      setResult(data);
      setStep(5);
      toast.success("สร้างรูปสำเร็จ");
    } else {
      toast.error(data.error || "สร้างรูปไม่สำเร็จ");
    }
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
              {products.length === 0 ? (
                <p className="text-muted-foreground">ยังไม่มีสินค้า — ติดต่อผู้ดูแล</p>
              ) : (
                <div className="mx-auto w-full max-w-md space-y-2">
                  <Label>สินค้า</Label>
                  <Select
                    value={productId}
                    onValueChange={(v) => {
                      setProductId(v ?? "");
                      setPatternId("");
                      setPatterns([]);
                    }}
                  >
                    <SelectTrigger className="h-11 w-full">
                      <SelectValue placeholder="เลือกสินค้า">
                        {selectedProduct?.name}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="generate-actions">
                <Button onClick={() => setStep(1)} disabled={!productId} className="min-w-32">
                  ถัดไป
                </Button>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              {patterns.length === 0 ? (
                <p className="text-muted-foreground">ไม่มีรูปแบบสำหรับสินค้านี้</p>
              ) : (
                <div className="mx-auto grid w-full max-w-lg gap-3 sm:grid-cols-2">
                  {patterns.map((pattern) => (
                    <button
                      key={pattern.id}
                      type="button"
                      onClick={() => setPatternId(pattern.id)}
                      className={`rounded-xl border p-4 text-left transition-all ${
                        patternId === pattern.id
                          ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/20"
                          : "border-border hover:border-accent/50 hover:bg-secondary/50"
                      }`}
                    >
                      {pattern.thumbnail_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={pattern.thumbnail_url}
                          alt={pattern.name}
                          className="mb-2 h-24 w-full rounded object-cover"
                        />
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
                <Button variant="outline" onClick={() => setStep(0)}>
                  ย้อนกลับ
                </Button>
                <Button onClick={() => setStep(2)} disabled={!patternId} className="min-w-32">
                  ถัดไป
                </Button>
              </div>
            </>
          )}

          {step === 2 && (
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
                <Button variant="outline" onClick={() => setStep(1)}>
                  ย้อนกลับ
                </Button>
                <Button onClick={() => setStep(3)} disabled={!shapeId} className="min-w-32">
                  ถัดไป
                </Button>
              </div>
            </>
          )}

          {step === 3 && (
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
                <Button variant="outline" onClick={() => setStep(2)}>
                  ย้อนกลับ
                </Button>
                <Button
                  onClick={() =>
                    setStep(selectedPattern?.requires_image ? 4 : 5)
                  }
                  className="min-w-32"
                >
                  ถัดไป
                </Button>
              </div>
            </>
          )}

          {step === 4 && selectedPattern?.requires_image && (
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
                <Button variant="outline" onClick={() => setStep(3)}>
                  ย้อนกลับ
                </Button>
                <Button onClick={() => setStep(5)} disabled={!uploadedImageUrl} className="min-w-32">
                  ถัดไป
                </Button>
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <div className="mx-auto w-full max-w-md space-y-4">
              <div className="rounded-xl bg-muted/80 p-4 text-base">
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
                disabled={generating}
              >
                {generating ? "กำลังสร้างรูป..." : "สร้างรูป"}
              </Button>
              </div>
              <div className="generate-actions">
              {!selectedPattern?.requires_image && (
                <Button variant="outline" onClick={() => setStep(3)}>
                  ย้อนกลับ
                </Button>
              )}
              {selectedPattern?.requires_image && (
                <Button variant="outline" onClick={() => setStep(4)}>
                  ย้อนกลับ
                </Button>
              )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card className="generate-card mt-8">
          <CardHeader className="text-center">
            <CardTitle className="text-xl sm:text-2xl">ผลลัพธ์</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={result.outputImageUrl}
              alt="ผลลัพธ์"
              className="mx-auto max-h-[480px] rounded-lg border"
            />
            <div className="generate-actions">
              <a
                href={result.outputImageUrl}
                download
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ className: "min-w-40" })}
              >
                ดาวน์โหลด PNG
              </a>
            </div>

            <div className="mx-auto max-w-md rounded-xl border bg-muted/50 p-4">
              <h3 className="mb-2 font-semibold">สรุป Token</h3>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <p>Input Text: {result.usage.input_text_tokens.toLocaleString()}</p>
                <p>Input Image: {result.usage.input_image_tokens.toLocaleString()}</p>
                <p>Output Image: {result.usage.output_image_tokens.toLocaleString()}</p>
                <p>รวม: {result.usage.total_tokens.toLocaleString()}</p>
              </div>
              <p className="mt-4 cost-highlight">
                ค่าใช้จ่าย: {result.costThbDisplay} บาท
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
