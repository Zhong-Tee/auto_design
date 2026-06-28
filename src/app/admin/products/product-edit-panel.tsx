"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { saveProduct, saveTextBoxConfig, updateProductImage } from "./actions";
import { resolveImageContentType } from "@/lib/image-content-type";
import { getTextPromptTag } from "@/lib/prompt";
import type { Product, TextBoxConfig } from "@/types/database";

type ProductWithConfigs = Product & { text_box_configs: TextBoxConfig[] };

type ConfigRow = {
  id: string | null;
  product_id: string;
  position: number;
  label: string | null;
  placeholder: string | null;
  max_length: number | null;
};

interface EditableTextBoxRowProps {
  config: ConfigRow;
  pending: boolean;
  onSave: (formData: FormData) => void;
}

function EditableTextBoxRow({ config, pending, onSave }: EditableTextBoxRowProps) {
  const [label, setLabel] = useState(config.label ?? "");
  const [placeholder, setPlaceholder] = useState(config.placeholder ?? "");
  const [maxLength, setMaxLength] = useState(
    config.max_length != null ? String(config.max_length) : ""
  );

  useEffect(() => {
    setLabel(config.label ?? "");
    setPlaceholder(config.placeholder ?? "");
    setMaxLength(config.max_length != null ? String(config.max_length) : "");
  }, [config.label, config.placeholder, config.max_length]);

  function handleSave() {
    const formData = new FormData();
    if (config.id) formData.set("id", config.id);
    formData.set("product_id", config.product_id);
    formData.set("position", String(config.position));
    formData.set("label", label);
    formData.set("placeholder", placeholder);
    formData.set("max_length", maxLength);
    onSave(formData);
  }

  const promptTag = getTextPromptTag(config.position);

  return (
    <TableRow>
      <TableCell className="font-medium">{config.position}</TableCell>
      <TableCell>
        <Badge variant="outline" className="font-mono text-xs">
          {promptTag}
        </Badge>
      </TableCell>
      <TableCell>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="min-w-32"
        />
      </TableCell>
      <TableCell>
        <Input
          value={placeholder}
          onChange={(e) => setPlaceholder(e.target.value)}
          className="min-w-32"
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={1}
          value={maxLength}
          onChange={(e) => setMaxLength(e.target.value)}
          className="w-24"
        />
      </TableCell>
      <TableCell className="text-right">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={handleSave}
        >
          บันทึก
        </Button>
      </TableCell>
    </TableRow>
  );
}

interface ProductEditPanelProps {
  initialProduct: ProductWithConfigs;
}

export function ProductEditPanel({ initialProduct }: ProductEditPanelProps) {
  const router = useRouter();
  const product = initialProduct;
  const [textBoxCount, setTextBoxCount] = useState(product.text_box_count ?? 0);
  const [isActive, setIsActive] = useState(product.is_active === true);
  const [imageUrl, setImageUrl] = useState(product.image_url ?? "");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setTextBoxCount(product.text_box_count ?? 0);
    setIsActive(product.is_active === true);
    setImageUrl(product.image_url ?? "");
  }, [product.text_box_count, product.is_active, product.image_url]);

  const configRows = useMemo(() => {
    const byPosition = new Map(
      (product.text_box_configs ?? []).map((cfg) => [cfg.position, cfg])
    );

    return Array.from({ length: textBoxCount }, (_, index) => {
      const position = index + 1;
      const existing = byPosition.get(position);

      if (existing) {
        return {
          id: existing.id,
          product_id: product.id,
          position: existing.position,
          label: existing.label,
          placeholder: existing.placeholder,
          max_length: existing.max_length,
        } satisfies ConfigRow;
      }

      return {
        id: null,
        product_id: product.id,
        position,
        label: null,
        placeholder: null,
        max_length: null,
      } satisfies ConfigRow;
    });
  }, [product.id, product.text_box_configs, textBoxCount]);

  function handleSaveProduct(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("text_box_count", String(textBoxCount));
    formData.set("is_active", isActive ? "true" : "false");
    formData.set("image_url", imageUrl.trim());

    startTransition(async () => {
      try {
        await saveProduct(formData);
        toast.success("บันทึกสินค้าสำเร็จ");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
      }
    });
  }

  function handleSaveTextBoxConfig(formData: FormData) {
    startTransition(async () => {
      try {
        await saveTextBoxConfig(formData);
        toast.success(
          formData.get("id") ? "บันทึก config สำเร็จ" : "เพิ่ม config สำเร็จ"
        );
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "บันทึก config ไม่สำเร็จ");
      }
    });
  }

  async function handleImageUpload(file: File) {
    if (!resolveImageContentType(file)) {
      toast.error("รองรับเฉพาะ PNG/jpeg");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("ไฟล์ใหญ่เกิน 10MB");
      return;
    }

    setUploadingImage(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "อัปโหลดไม่สำเร็จ");
        return;
      }

      await updateProductImage(product.id, data.url);
      setImageUrl(data.url);
      toast.success("อัปโหลดรูปสำเร็จ");
      router.refresh();
    } catch {
      toast.error("อัปโหลดไม่สำเร็จ");
    } finally {
      setUploadingImage(false);
    }
  }

  function handleRemoveImage() {
    if (!confirm("ลบรูปสินค้านี้?")) return;
    startTransition(async () => {
      try {
        await updateProductImage(product.id, null);
        setImageUrl("");
        toast.success("ลบรูปสำเร็จ");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "ลบรูปไม่สำเร็จ");
      }
    });
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/admin/products"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            ← กลับรายการสินค้า
          </Link>
          <h1 className="page-title !mb-0 mt-2">แก้ไขสินค้า</h1>
          <p className="text-sm text-muted-foreground">{product.name}</p>
        </div>
      </div>

      <div className="mb-8 rounded-lg border p-4">
        <h2 className="mb-4 font-semibold">ข้อมูลสินค้า</h2>
        <form onSubmit={handleSaveProduct} className="space-y-4">
          <input type="hidden" name="id" value={product.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>ชื่อสินค้า</Label>
              <Input name="name" defaultValue={product.name} required />
            </div>
            <div className="space-y-2">
              <Label>จำนวนกล่องข้อความ</Label>
              <Input
                type="number"
                min={0}
                value={textBoxCount}
                onChange={(e) => {
                  const next = parseInt(e.target.value, 10);
                  setTextBoxCount(Number.isFinite(next) ? Math.max(0, next) : 0);
                }}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>คำอธบาย</Label>
            <Textarea name="description" defaultValue={product.description ?? ""} />
          </div>
          <div className="space-y-3">
            <Label>รูปสินค้า</Label>
            <Input
              type="file"
              accept="image/png,image/jpeg"
              disabled={uploadingImage || pending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImageUpload(file);
                e.target.value = "";
              }}
            />
            <p className="text-xs text-muted-foreground">
              PNG/JPEG สูงสุด 10MB — แสดงในหน้าเลือกสินค้า
            </p>
            {imageUrl ? (
              <div className="flex flex-wrap items-start gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt={product.name}
                  className="h-36 max-w-full rounded-lg border object-contain"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending || uploadingImage}
                  onClick={handleRemoveImage}
                >
                  ลบรูป
                </Button>
              </div>
            ) : (
              <div className="flex h-36 w-full max-w-xs items-center justify-center rounded-lg border border-dashed bg-muted/40 text-sm text-muted-foreground">
                ยังไม่มีรูป
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(checked === true)}
            />
            <Label>เปิดใช้งาน</Label>
          </div>
          <Button type="submit" disabled={pending}>
            บันทึกข้อมูลสินค้า
          </Button>
        </form>
      </div>

      <div className="rounded-lg border p-4">
        <h2 className="mb-1 font-semibold">กล่องข้อความ</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          แสดง {textBoxCount} ลำดับตามจำนวนกล่องข้อความ — กด &quot;บันทึกข้อมูลสินค้า&quot;
          เพื่อ sync ลงฐานข้อมูล
        </p>

        {textBoxCount === 0 ? (
          <p className="text-sm text-muted-foreground">ไม่มีกล่องข้อความ</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ลำดับ</TableHead>
                  <TableHead>อ้างอิง Prompt</TableHead>
                  <TableHead>ป้ายกำกับ</TableHead>
                  <TableHead>ตัวอย่างในฟอร์ม</TableHead>
                  <TableHead>ความยาวสูงสุด</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {configRows.map((cfg) => (
                  <EditableTextBoxRow
                    key={`${cfg.position}-${cfg.id ?? "draft"}`}
                    config={cfg}
                    pending={pending}
                    onSave={handleSaveTextBoxConfig}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          ลำดับ N ใช้กับ{" "}
          <code className="rounded bg-muted px-1">{`{{textN}}`}</code> ใน Prompt Template
          (เช่น ลำดับ 1 = {`{{text1}}`}, ลำดับ 2 = {`{{text2}}`})
        </p>
      </div>
    </div>
  );
}
