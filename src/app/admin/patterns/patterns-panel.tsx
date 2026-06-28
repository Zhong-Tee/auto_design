"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getPlaceholderHints } from "@/lib/prompt";
import { savePattern, deletePattern } from "./actions";
import type { Pattern, Product, Prompt } from "@/types/database";

type PatternRow = Pattern & { products: { name: string } | null };

interface PatternsPanelProps {
  initialPatterns: PatternRow[];
  products: Pick<Product, "id" | "name" | "text_box_count">[];
  prompts: Pick<Prompt, "id" | "name" | "content">[];
}

export function PatternsPanel({
  initialPatterns,
  products,
  prompts,
}: PatternsPanelProps) {
  const router = useRouter();
  const [patterns, setPatterns] = useState(initialPatterns);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PatternRow | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setPatterns(initialPatterns);
  }, [initialPatterns]);

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  function openCreate() {
    setEditing(null);
    setSelectedProductId(products[0]?.id ?? "");
    setOpen(true);
  }

  function openEdit(pattern: PatternRow) {
    setEditing(pattern);
    setSelectedProductId(pattern.product_id);
    setOpen(true);
  }

  function handleSave(formData: FormData) {
    formData.set("product_id", selectedProductId);
    startTransition(async () => {
      try {
        await savePattern(formData);
        toast.success("บันทึกรูปแบบสำเร็จ");
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
      }
    });
  }

  function insertPrompt(content: string) {
    const textarea = document.querySelector(
      'textarea[name="prompt_template"]'
    ) as HTMLTextAreaElement | null;
    if (textarea) {
      textarea.value = content;
    }
    setPromptOpen(false);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="page-title !mb-0">จัดการรูปแบบ</h1>
        <Button onClick={openCreate} disabled={products.length === 0}>
          เพิ่มรูปแบบ
        </Button>
      </div>

      {patterns.length === 0 ? (
        <p className="text-muted-foreground">ยังไม่มีรูปแบบ</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อ</TableHead>
                <TableHead>สินค้า</TableHead>
                <TableHead>ต้องมีรูป</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {patterns.map((pattern) => (
                <TableRow key={pattern.id}>
                  <TableCell>{pattern.name}</TableCell>
                  <TableCell>{pattern.products?.name ?? "-"}</TableCell>
                  <TableCell>{pattern.requires_image ? "ใช่" : "ไม่"}</TableCell>
                  <TableCell>
                    <Badge variant={pattern.is_active ? "default" : "secondary"}>
                      {pattern.is_active ? "เปิด" : "ปิด"}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button variant="outline" size="sm" onClick={() => openEdit(pattern)}>
                      แก้ไข
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={pending}
                      onClick={() => {
                        if (!confirm("ลบรูปแบบนี้?")) return;
                        startTransition(async () => {
                          await deletePattern(pattern.id);
                          setPatterns((prev) => prev.filter((p) => p.id !== pattern.id));
                          toast.success("ลบสำเร็จ");
                        });
                      }}
                    >
                      ลบ
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "แก้ไขรูปแบบ" : "เพิ่มรูปแบบ"}</DialogTitle>
          </DialogHeader>
          <form action={handleSave} className="space-y-4">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="space-y-2">
              <Label>สินค้า</Label>
              <Select
                value={selectedProductId}
                onValueChange={(v) => setSelectedProductId(v ?? "")}
              >
                <SelectTrigger>
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
            <div className="space-y-2">
              <Label>ชื่อรูปแบบ</Label>
              <Input name="name" defaultValue={editing?.name} required />
            </div>
            <div className="space-y-2">
              <Label>URL รูปตัวอย่าง</Label>
              <Input name="thumbnail_url" defaultValue={editing?.thumbnail_url ?? ""} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Prompt Template</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPromptOpen(true)}
                >
                  แทรกจากคลัง Prompt
                </Button>
              </div>
              <Textarea
                name="prompt_template"
                rows={6}
                defaultValue={editing?.prompt_template ?? ""}
                required
                className="[field-sizing:fixed] max-h-48 overflow-y-auto"
              />
              {selectedProduct && (
                <p className="text-xs text-muted-foreground">
                  Placeholder ที่ใช้ได้:{" "}
                  {getPlaceholderHints(selectedProduct.text_box_count).join(", ")}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Switch
                defaultChecked={editing?.requires_image ?? false}
                onCheckedChange={(checked) => {
                  const input = document.querySelector(
                    'input[name="requires_image"]'
                  ) as HTMLInputElement | null;
                  if (input) input.value = checked ? "true" : "false";
                }}
              />
              <Label>ต้องอัปโหลดรูปคน</Label>
              <input
                type="hidden"
                name="requires_image"
                defaultValue={editing?.requires_image ? "true" : "false"}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                defaultChecked={editing?.is_active ?? true}
                onCheckedChange={(checked) => {
                  const input = document.querySelector(
                    'input[name="is_active"]'
                  ) as HTMLInputElement | null;
                  if (input) input.value = checked ? "true" : "false";
                }}
              />
              <Label>เปิดใช้งาน</Label>
              <input
                type="hidden"
                name="is_active"
                defaultValue={editing?.is_active !== false ? "true" : "false"}
              />
            </div>
            <Button type="submit" disabled={pending || !selectedProductId}>
              บันทึก
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={promptOpen} onOpenChange={setPromptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เลือก Prompt จากคลัง</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {prompts.length === 0 ? (
              <p className="text-sm text-muted-foreground">ยังไม่มี prompt ในคลัง</p>
            ) : (
              prompts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="w-full rounded-md border p-3 text-left hover:bg-muted"
                  onClick={() => insertPrompt(p.content)}
                >
                  <p className="font-medium">{p.name}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{p.content}</p>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
