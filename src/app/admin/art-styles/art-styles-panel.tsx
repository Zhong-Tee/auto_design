"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { sanitizeVariableKey } from "@/lib/prompt";
import { saveArtStyle, deleteArtStyle, reorderArtStyle } from "./actions";
import type { ArtStyle, ArtStyleVariable, Prompt } from "@/types/database";

interface ArtStylesPanelProps {
  initialArtStyles: ArtStyle[];
  prompts: Pick<Prompt, "id" | "name" | "content">[];
}

export function ArtStylesPanel({
  initialArtStyles,
  prompts,
}: ArtStylesPanelProps) {
  const router = useRouter();
  const [artStyles, setArtStyles] = useState(initialArtStyles);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ArtStyle | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [variables, setVariables] = useState<ArtStyleVariable[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setArtStyles(initialArtStyles);
  }, [initialArtStyles]);

  const sortedArtStyles = useMemo(
    () => [...artStyles].sort((a, b) => a.sort_order - b.sort_order),
    [artStyles]
  );

  function handleReorder(style: ArtStyle, direction: "up" | "down") {
    startTransition(async () => {
      try {
        await reorderArtStyle(style.id, direction);
        setArtStyles((prev) => {
          const sorted = [...prev].sort((a, b) => a.sort_order - b.sort_order);
          const index = sorted.findIndex((s) => s.id === style.id);
          const swapIndex = direction === "up" ? index - 1 : index + 1;
          const current = sorted[index];
          const neighbor = sorted[swapIndex];
          if (!current || !neighbor) return prev;

          return prev.map((s) => {
            if (s.id === current.id) return { ...s, sort_order: neighbor.sort_order };
            if (s.id === neighbor.id) return { ...s, sort_order: current.sort_order };
            return s;
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
    setVariables([]);
    setOpen(true);
  }

  function openEdit(style: ArtStyle) {
    setEditing(style);
    setVariables(style.variables ?? []);
    setOpen(true);
  }

  function addVariable() {
    setVariables((prev) => [...prev, { key: "", label: "" }]);
  }

  function updateVariable(
    index: number,
    field: keyof ArtStyleVariable,
    value: string
  ) {
    setVariables((prev) =>
      prev.map((v, i) =>
        i === index
          ? {
              ...v,
              [field]: field === "key" ? sanitizeVariableKey(value) : value,
            }
          : v
      )
    );
  }

  function removeVariable(index: number) {
    setVariables((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSave(formData: FormData) {
    startTransition(async () => {
      try {
        await saveArtStyle(formData);
        toast.success("บันทึก Art Style สำเร็จ");
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
        <h1 className="page-title !mb-0">จัดการ Art Style</h1>
        <Button onClick={openCreate}>เพิ่ม Art Style</Button>
      </div>

      {sortedArtStyles.length === 0 ? (
        <p className="text-muted-foreground">ยังไม่มี Art Style</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">ลำดับ</TableHead>
                <TableHead>ชื่อ</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedArtStyles.map((style, index) => (
                <TableRow key={style.id}>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="w-6 text-center text-sm text-muted-foreground">
                        {style.sort_order}
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-7"
                          disabled={pending || index === 0}
                          onClick={() => handleReorder(style, "up")}
                          aria-label={`เลื่อน ${style.name} ขึ้น`}
                        >
                          <ChevronUpIcon className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-7"
                          disabled={pending || index === sortedArtStyles.length - 1}
                          onClick={() => handleReorder(style, "down")}
                          aria-label={`เลื่อน ${style.name} ลง`}
                        >
                          <ChevronDownIcon className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{style.name}</TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button variant="outline" size="sm" onClick={() => openEdit(style)}>
                      แก้ไข
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={pending}
                      onClick={() => {
                        if (!confirm("ลบ Art Style นี้?")) return;
                        startTransition(async () => {
                          await deleteArtStyle(style.id);
                          setArtStyles((prev) => prev.filter((s) => s.id !== style.id));
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
            <DialogTitle>{editing ? "แก้ไข Art Style" : "เพิ่ม Art Style"}</DialogTitle>
          </DialogHeader>
          <form action={handleSave} className="space-y-4">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="space-y-2">
              <Label>ชื่อ Art Style</Label>
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
              <p className="text-xs text-muted-foreground">
                ใช้กับรูปที่ผู้ใช้อัปโหลด — อธิบายสไตล์ที่ต้องการแปลงรูป
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>กล่องตัวแปร</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addVariable}
                >
                  <PlusIcon className="size-4" />
                  เพิ่มตัวแปร
                </Button>
              </div>
              {variables.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  ยังไม่มีตัวแปร — เพิ่มเพื่อให้หน้าสร้างรูปมีกล่องกรอก
                  แล้วใช้ {"{{ชื่อตัวแปร}}"} ใน Prompt
                </p>
              ) : (
                <div className="space-y-2">
                  {variables.map((v, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={v.key}
                        onChange={(e) => updateVariable(i, "key", e.target.value)}
                        placeholder="ชื่อตัวแปร เช่น suite"
                        className="w-2/5"
                        aria-label="ชื่อตัวแปร"
                      />
                      <Input
                        value={v.label}
                        onChange={(e) =>
                          updateVariable(i, "label", e.target.value)
                        }
                        placeholder="หัวข้อ เช่น ชุดที่ต้องการ"
                        className="flex-1"
                        aria-label="หัวข้อกล่องกรอก"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        onClick={() => removeVariable(i)}
                        aria-label="ลบตัวแปร"
                      >
                        <XIcon className="size-4" />
                      </Button>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    ใส่ในเทมเพลต:{" "}
                    {variables
                      .filter((v) => v.key)
                      .map((v) => `{{${v.key}}}`)
                      .join(", ") || "—"}
                  </p>
                </div>
              )}
              <input
                type="hidden"
                name="variables"
                value={JSON.stringify(variables)}
                readOnly
              />
            </div>

            <Button type="submit" disabled={pending}>
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
