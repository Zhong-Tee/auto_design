"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import {
  QUALITY_OPTIONS,
  formatQualityLabel,
  formatSize,
  getShapeSizeErrors,
  isExperimentalResolution,
} from "@/lib/shapes";
import { saveShape, deleteShape } from "./actions";
import type { Shape } from "@/types/database";

interface ShapesPanelProps {
  initialShapes: Shape[];
}

export function ShapesPanel({ initialShapes }: ShapesPanelProps) {
  const router = useRouter();
  const [shapes, setShapes] = useState(initialShapes);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Shape | null>(null);
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [quality, setQuality] = useState<"low" | "medium" | "high">(
    editing?.quality ?? "medium"
  );
  const [pending, startTransition] = useTransition();

  const sizeErrors = getShapeSizeErrors(width, height);

  useEffect(() => {
    setShapes(initialShapes);
  }, [initialShapes]);

  function openCreate() {
    setEditing(null);
    setWidth(1024);
    setHeight(1024);
    setQuality("medium");
    setOpen(true);
  }

  function openEdit(shape: Shape) {
    setEditing(shape);
    setWidth(shape.width_px);
    setHeight(shape.height_px);
    setQuality(shape.quality);
    setOpen(true);
  }

  function handleSave(formData: FormData) {
    startTransition(async () => {
      try {
        await saveShape(formData);
        toast.success("บันทึกรูปทรงสำเร็จ");
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
      }
    });
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="page-title !mb-0">จัดการรูปทรง</h1>
        <Button onClick={openCreate}>เพิ่มรูปทรง</Button>
      </div>

      {shapes.length === 0 ? (
        <p className="text-muted-foreground">ยังไม่มีรูปทรง</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อ</TableHead>
                <TableHead>ขนาด</TableHead>
                <TableHead>ความละเอียด</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shapes.map((shape) => (
                <TableRow key={shape.id}>
                  <TableCell>{shape.name}</TableCell>
                  <TableCell>{formatSize(shape.width_px, shape.height_px)}</TableCell>
                  <TableCell>{formatQualityLabel(shape.quality)}</TableCell>
                  <TableCell>
                    <Badge variant={shape.is_active ? "default" : "secondary"}>
                      {shape.is_active ? "เปิด" : "ปิด"}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button variant="outline" size="sm" onClick={() => openEdit(shape)}>
                      แก้ไข
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={pending}
                      onClick={() => {
                        if (!confirm("ลบรูปทรงนี้?")) return;
                        startTransition(async () => {
                          await deleteShape(shape.id);
                          setShapes((prev) => prev.filter((s) => s.id !== shape.id));
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "แก้ไขรูปทรง" : "เพิ่มรูปทรง"}</DialogTitle>
          </DialogHeader>
          <form action={handleSave} className="space-y-4">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="space-y-2">
              <Label>ชื่อ</Label>
              <Input name="name" defaultValue={editing?.name} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ความกว้าง (px)</Label>
                <Input
                  name="width_px"
                  type="number"
                  min={1}
                  value={width}
                  onChange={(e) => setWidth(parseInt(e.target.value, 10) || 0)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>ความสูง (px)</Label>
                <Input
                  name="height_px"
                  type="number"
                  min={1}
                  value={height}
                  onChange={(e) => setHeight(parseInt(e.target.value, 10) || 0)}
                  required
                />
              </div>
            </div>
            {sizeErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertDescription>{sizeErrors.join(" · ")}</AlertDescription>
              </Alert>
            )}
            {sizeErrors.length === 0 && isExperimentalResolution(width, height) && (
              <Alert>
                <AlertDescription>
                  ความละเอียดเกิน 2K — อาจมีผลลัพธ์ไม่แน่นอน
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label>ระดับความละเอียด</Label>
              <Select value={quality} onValueChange={(v) => setQuality((v ?? "medium") as typeof quality)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUALITY_OPTIONS.map((opt, i) => (
                    <SelectItem key={`${opt.label}-${i}`} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="quality" value={quality} />
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
            <Button type="submit" disabled={pending || sizeErrors.length > 0}>
              บันทึก
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
