"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { savePrompt, deletePrompt } from "./actions";
import type { Prompt } from "@/types/database";

interface PromptsPanelProps {
  initialPrompts: Prompt[];
}

export function PromptsPanel({ initialPrompts }: PromptsPanelProps) {
  const router = useRouter();
  const [prompts, setPrompts] = useState(initialPrompts);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Prompt | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setPrompts(initialPrompts);
  }, [initialPrompts]);

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(prompt: Prompt) {
    setEditing(prompt);
    setOpen(true);
  }

  function handleSave(formData: FormData) {
    startTransition(async () => {
      try {
        await savePrompt(formData);
        toast.success("บันทึก prompt สำเร็จ");
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
        <h1 className="page-title !mb-0">คลัง Prompt</h1>
        <Button onClick={openCreate}>เพิ่ม Prompt</Button>
      </div>

      {prompts.length === 0 ? (
        <p className="text-muted-foreground">ยังไม่มี prompt</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อ</TableHead>
                <TableHead>แท็ก</TableHead>
                <TableHead>อัปเดต</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prompts.map((prompt) => (
                <TableRow key={prompt.id}>
                  <TableCell>{prompt.name}</TableCell>
                  <TableCell>{prompt.tags?.join(", ") || "-"}</TableCell>
                  <TableCell>
                    {new Date(prompt.updated_at).toLocaleDateString("th-TH")}
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button variant="outline" size="sm" onClick={() => openEdit(prompt)}>
                      แก้ไข
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={pending}
                      onClick={() => {
                        if (!confirm("ลบ prompt นี้?")) return;
                        startTransition(async () => {
                          await deletePrompt(prompt.id);
                          setPrompts((prev) => prev.filter((p) => p.id !== prompt.id));
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
            <DialogTitle>{editing ? "แก้ไข Prompt" : "เพิ่ม Prompt"}</DialogTitle>
          </DialogHeader>
          <form action={handleSave} className="space-y-4">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="space-y-2">
              <Label>ชื่อ</Label>
              <Input name="name" defaultValue={editing?.name} required />
            </div>
            <div className="space-y-2">
              <Label>เนื้อหา</Label>
              <Textarea
                name="content"
                rows={8}
                defaultValue={editing?.content ?? ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>แท็ก (คั่นด้วย comma)</Label>
              <Input
                name="tags"
                defaultValue={editing?.tags?.join(", ") ?? ""}
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
