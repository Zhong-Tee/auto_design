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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  saveProduct,
  deleteProduct,
  saveTextBoxConfig,
  deleteTextBoxConfig,
} from "./actions";
import { getTextPromptTag } from "@/lib/prompt";
import type { Product, TextBoxConfig } from "@/types/database";

type ProductWithConfigs = Product & { text_box_configs: TextBoxConfig[] };

interface EditableTextBoxRowProps {
  config: TextBoxConfig;
  productId: string;
  pending: boolean;
  onSave: (formData: FormData) => void;
  onDelete: () => void;
}

function EditableTextBoxRow({
  config,
  productId,
  pending,
  onSave,
  onDelete,
}: EditableTextBoxRowProps) {
  const [position, setPosition] = useState(String(config.position));
  const [label, setLabel] = useState(config.label ?? "");
  const [placeholder, setPlaceholder] = useState(config.placeholder ?? "");
  const [maxLength, setMaxLength] = useState(
    config.max_length != null ? String(config.max_length) : ""
  );

  function handleSave() {
    const formData = new FormData();
    formData.set("id", config.id);
    formData.set("product_id", productId);
    formData.set("position", position);
    formData.set("label", label);
    formData.set("placeholder", placeholder);
    formData.set("max_length", maxLength);
    onSave(formData);
  }

  const positionNum = parseInt(position, 10);
  const promptTag =
    Number.isFinite(positionNum) && positionNum > 0
      ? getTextPromptTag(positionNum)
      : null;

  return (
    <TableRow>
      <TableCell>
        <Input
          type="number"
          min={1}
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          className="w-20"
        />
      </TableCell>
      <TableCell>
        {promptTag ? (
          <Badge variant="outline" className="font-mono text-xs">
            {promptTag}
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
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
      <TableCell className="space-x-2 text-right">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={handleSave}
        >
          บันทึก
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={onDelete}>
          ลบ
        </Button>
      </TableCell>
    </TableRow>
  );
}

function AddTextBoxForm({
  productId,
  pending,
  onSave,
}: {
  productId: string;
  pending: boolean;
  onSave: (formData: FormData) => void;
}) {
  const [position, setPosition] = useState("");
  const positionNum = parseInt(position, 10);
  const promptTag =
    Number.isFinite(positionNum) && positionNum > 0
      ? getTextPromptTag(positionNum)
      : null;

  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-2 border-t pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        formData.set("product_id", productId);
        onSave(formData);
        e.currentTarget.reset();
        setPosition("");
      }}
    >
      <div>
        <Label className="text-xs">ลำดับ</Label>
        <Input
          name="position"
          type="number"
          min={1}
          className="w-20"
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          required
        />
      </div>
      <div>
        <Label className="text-xs">อ้างอิง Prompt</Label>
        <div className="flex h-8 items-center">
          {promptTag ? (
            <Badge variant="outline" className="font-mono text-xs">
              {promptTag}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">กรอกลำดับ</span>
          )}
        </div>
      </div>
      <div>
        <Label className="text-xs">ป้ายกำกับ</Label>
        <Input name="label" className="w-32" />
      </div>
      <div>
        <Label className="text-xs">ตัวอย่างในฟอร์ม</Label>
        <Input name="placeholder" className="w-32" />
      </div>
      <div>
        <Label className="text-xs">ความยาวสูงสุด</Label>
        <Input name="max_length" type="number" className="w-24" />
      </div>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        เพิ่มกล่องข้อความ
      </Button>
    </form>
  );
}

interface ProductsPanelProps {
  initialProducts: ProductWithConfigs[];
}

export function ProductsPanel({ initialProducts }: ProductsPanelProps) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductWithConfigs | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(product: ProductWithConfigs) {
    setEditing(product);
    setOpen(true);
  }

  function handleSave(formData: FormData) {
    startTransition(async () => {
      try {
        await saveProduct(formData);
        toast.success("บันทึกสินค้าสำเร็จ");
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("ลบสินค้านี้?")) return;
    startTransition(async () => {
      try {
        await deleteProduct(id);
        setProducts((prev) => prev.filter((p) => p.id !== id));
        toast.success("ลบสำเร็จ");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
      }
    });
  }

  function handleSaveTextBoxConfig(formData: FormData) {
    startTransition(async () => {
      try {
        await saveTextBoxConfig(formData);
        toast.success(formData.get("id") ? "บันทึก config สำเร็จ" : "เพิ่ม config สำเร็จ");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "บันทึก config ไม่สำเร็จ");
      }
    });
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="page-title !mb-0">จัดการสินค้า</h1>
        <Button onClick={openCreate}>เพิ่มสินค้า</Button>
      </div>

      {products.length === 0 ? (
        <p className="text-muted-foreground">ยังไม่มีสินค้า</p>
      ) : (
        <div className="space-y-6">
          {products.map((product) => (
            <div key={product.id} className="rounded-lg border p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{product.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {product.description || "ไม่มีคำอธบาย"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={product.is_active ? "default" : "secondary"}>
                    {product.is_active ? "เปิดใช้" : "ปิด"}
                  </Badge>
                  <Badge variant="outline">
                    กล่องข้อความ: {product.text_box_count}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => openEdit(product)}>
                    แก้ไข
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(product.id)}
                    disabled={pending}
                  >
                    ลบ
                  </Button>
                </div>
              </div>

              {product.text_box_configs?.length > 0 && (
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
                    {product.text_box_configs
                      .sort((a, b) => a.position - b.position)
                      .map((cfg) => (
                        <EditableTextBoxRow
                          key={cfg.id}
                          config={cfg}
                          productId={product.id}
                          pending={pending}
                          onSave={handleSaveTextBoxConfig}
                          onDelete={() => {
                            if (!confirm("ลบ config นี้?")) return;
                            startTransition(async () => {
                              try {
                                await deleteTextBoxConfig(cfg.id);
                                toast.success("ลบ config สำเร็จ");
                                router.refresh();
                              } catch (e) {
                                toast.error(
                                  e instanceof Error ? e.message : "ลบ config ไม่สำเร็จ"
                                );
                              }
                            });
                          }}
                        />
                      ))}
                  </TableBody>
                </Table>
              )}

              <p className="mt-3 text-xs text-muted-foreground">
                ลำดับ N ใช้กับ{" "}
                <code className="rounded bg-muted px-1">{`{{textN}}`}</code> ใน Prompt Template
                (เช่น ลำดับ 1 = {`{{text1}}`}, ลำดับ 2 = {`{{text2}}`})
              </p>

              <AddTextBoxForm
                productId={product.id}
                pending={pending}
                onSave={handleSaveTextBoxConfig}
              />
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}</DialogTitle>
          </DialogHeader>
          <form action={handleSave} className="space-y-4">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="space-y-2">
              <Label>ชื่อสินค้า</Label>
              <Input name="name" defaultValue={editing?.name} required />
            </div>
            <div className="space-y-2">
              <Label>คำอธบาย</Label>
              <Textarea name="description" defaultValue={editing?.description ?? ""} />
            </div>
            <div className="space-y-2">
              <Label>จำนวนกล่องข้อความ</Label>
              <Input
                name="text_box_count"
                type="number"
                min={0}
                defaultValue={editing?.text_box_count ?? 1}
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                name="is_active"
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
            <Button type="submit" disabled={pending}>
              บันทึก
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
