"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { saveProduct, deleteProduct } from "./actions";
import type { Product } from "@/types/database";

interface ProductsPanelProps {
  initialProducts: Product[];
}

export function ProductsPanel({ initialProducts }: ProductsPanelProps) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      try {
        await saveProduct(formData);
        toast.success("เพิ่มสินค้าสำเร็จ");
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
      }
    });
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`ลบสินค้า "${name}"?`)) return;
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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="page-title !mb-0">จัดการสินค้า</h1>
        <Button onClick={() => setOpen(true)}>เพิ่มสินค้า</Button>
      </div>

      {products.length === 0 ? (
        <p className="text-muted-foreground">ยังไม่มีสินค้า</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อสินค้า</TableHead>
                <TableHead>คำอธบาย</TableHead>
                <TableHead>กล่องข้อความ</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {product.description || "—"}
                  </TableCell>
                  <TableCell>{product.text_box_count}</TableCell>
                  <TableCell>
                    <Badge variant={product.is_active ? "default" : "secondary"}>
                      {product.is_active ? "เปิดใช้" : "ปิด"}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Link
                      href={`/admin/products/${product.id}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      แก้ไข
                    </Link>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(product.id, product.name)}
                      disabled={pending}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เพิ่มสินค้า</DialogTitle>
          </DialogHeader>
          <form action={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>ชื่อสินค้า</Label>
              <Input name="name" required />
            </div>
            <div className="space-y-2">
              <Label>คำอธบาย</Label>
              <Textarea name="description" />
            </div>
            <div className="space-y-2">
              <Label>จำนวนกล่องข้อความ</Label>
              <Input name="text_box_count" type="number" min={0} defaultValue={1} required />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                name="is_active"
                defaultChecked
                onCheckedChange={(checked) => {
                  const input = document.querySelector(
                    'input[name="is_active"]'
                  ) as HTMLInputElement | null;
                  if (input) input.value = checked ? "true" : "false";
                }}
              />
              <Label>เปิดใช้งาน</Label>
              <input type="hidden" name="is_active" defaultValue="true" />
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
