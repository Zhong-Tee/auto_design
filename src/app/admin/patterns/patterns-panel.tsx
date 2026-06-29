"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
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
import { savePattern, deletePattern, reorderPattern } from "./actions";
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
  const [filterProductId, setFilterProductId] = useState("all");
  const [formProductId, setFormProductId] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setPatterns(initialPatterns);
  }, [initialPatterns]);

  const formProduct = products.find((p) => p.id === formProductId);
  const filterProduct = products.find((p) => p.id === filterProductId);

  const sortedPatterns = useMemo(
    () =>
      [...patterns]
        .filter(
          (pattern) =>
            filterProductId === "all" || pattern.product_id === filterProductId
        )
        .sort((a, b) => a.sort_order - b.sort_order),
    [patterns, filterProductId]
  );

  const productPatternCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const pattern of patterns) {
      counts.set(pattern.product_id, (counts.get(pattern.product_id) ?? 0) + 1);
    }
    return counts;
  }, [patterns]);

  function canMoveUp(pattern: PatternRow) {
    const sameProduct = sortedPatterns.filter((p) => p.product_id === pattern.product_id);
    return sameProduct[0]?.id !== pattern.id;
  }

  function canMoveDown(pattern: PatternRow) {
    const sameProduct = sortedPatterns.filter((p) => p.product_id === pattern.product_id);
    return sameProduct[sameProduct.length - 1]?.id !== pattern.id;
  }

  function handleReorder(pattern: PatternRow, direction: "up" | "down") {
    startTransition(async () => {
      try {
        await reorderPattern(pattern.id, direction);
        setPatterns((prev) => {
          const sameProduct = [...prev]
            .filter((p) => p.product_id === pattern.product_id)
            .sort((a, b) => a.sort_order - b.sort_order);
          const index = sameProduct.findIndex((p) => p.id === pattern.id);
          const swapIndex = direction === "up" ? index - 1 : index + 1;
          const current = sameProduct[index];
          const neighbor = sameProduct[swapIndex];
          if (!current || !neighbor) return prev;

          return prev.map((p) => {
            if (p.id === current.id) return { ...p, sort_order: neighbor.sort_order };
            if (p.id === neighbor.id) return { ...p, sort_order: current.sort_order };
            return p;
          });
        });
        router.refresh();
        toast.success("อัปเดตลำดับสำเร็จ");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "อัปเดตลำดับไม่สำเร็จ");
      }
    });
  }

  function openCreate() {
    setEditing(null);
    setFormProductId(
      filterProductId !== "all" ? filterProductId : (products[0]?.id ?? "")
    );
    setOpen(true);
  }

  function openEdit(pattern: PatternRow) {
    setEditing(pattern);
    setFormProductId(pattern.product_id);
    setOpen(true);
  }

  function handleSave(formData: FormData) {
    formData.set("product_id", formProductId);
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="page-title !mb-0">จัดการรูปแบบ</h1>
        <Button onClick={openCreate} disabled={products.length === 0}>
          เพิ่มรูปแบบ
        </Button>
      </div>

      {products.length > 0 && (
        <div className="mb-4 flex max-w-xs flex-col gap-2">
          <Label htmlFor="pattern-product-filter">สินค้า</Label>
          <Select
            value={filterProductId}
            onValueChange={(v) => setFilterProductId(v ?? "all")}
          >
            <SelectTrigger id="pattern-product-filter" className="w-full">
              <SelectValue placeholder="เลือกสินค้า">
                {filterProductId === "all"
                  ? "ทั้งหมด"
                  : filterProduct?.name}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด</SelectItem>
              {products.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {patterns.length === 0 ? (
        <p className="text-muted-foreground">ยังไม่มีรูปแบบ</p>
      ) : sortedPatterns.length === 0 ? (
        <p className="text-muted-foreground">
          ไม่มีรูปแบบสำหรับสินค้านี้
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">ลำดับ</TableHead>
                <TableHead>ชื่อ</TableHead>
                <TableHead>สินค้า</TableHead>
                <TableHead>ต้องมีรูป</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPatterns.map((pattern) => (
                <TableRow key={pattern.id}>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="w-6 text-center text-sm text-muted-foreground">
                        {pattern.sort_order}
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-7"
                          disabled={pending || !canMoveUp(pattern)}
                          onClick={() => handleReorder(pattern, "up")}
                          aria-label={`เลื่อน ${pattern.name} ขึ้น`}
                        >
                          <ChevronUpIcon className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-7"
                          disabled={
                            pending ||
                            !canMoveDown(pattern) ||
                            (productPatternCounts.get(pattern.product_id) ?? 0) <= 1
                          }
                          onClick={() => handleReorder(pattern, "down")}
                          aria-label={`เลื่อน ${pattern.name} ลง`}
                        >
                          <ChevronDownIcon className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </TableCell>
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
                value={formProductId}
                onValueChange={(v) => setFormProductId(v ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="เลือกสินค้า">
                    {formProduct?.name}
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
              {formProduct && (
                <p className="text-xs text-muted-foreground">
                  Placeholder ที่ใช้ได้:{" "}
                  {getPlaceholderHints(formProduct.text_box_count).join(", ")}
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
            <Button type="submit" disabled={pending || !formProductId}>
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
