"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatProfileLabel } from "@/lib/profile";
import type { Generation, Profile } from "@/types/database";

interface ReportsPanelProps {
  generations: Generation[];
  profiles: Pick<Profile, "id" | "email" | "display_name">[];
}

interface UserSummary {
  userId: string;
  label: string;
  count: number;
  totalTokens: number;
  totalCostThb: number;
}

export function ReportsPanel({ generations, profiles }: ReportsPanelProps) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [userId, setUserId] = useState("all");

  const profileLabels = useMemo(
    () =>
      Object.fromEntries(
        profiles.map((profile) => [profile.id, formatProfileLabel(profile)])
      ),
    [profiles]
  );

  const selectedUserLabel =
    userId === "all" ? "ทุกคน" : profileLabels[userId] ?? "ทุกคน";

  const filtered = useMemo(() => {
    return generations.filter((g) => {
      const created = new Date(g.created_at);
      if (startDate && created < new Date(startDate)) return false;
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (created > end) return false;
      }
      if (userId !== "all" && g.user_id !== userId) return false;
      return true;
    });
  }, [generations, startDate, endDate, userId]);

  const summaries = useMemo(() => {
    const map = new Map<string, UserSummary>();

    for (const gen of filtered) {
      const label = profileLabels[gen.user_id] ?? gen.user_id;
      const existing = map.get(gen.user_id) ?? {
        userId: gen.user_id,
        label,
        count: 0,
        totalTokens: 0,
        totalCostThb: 0,
      };

      existing.count += 1;
      existing.totalTokens += gen.total_tokens;
      existing.totalCostThb += Number(gen.cost_thb);

      map.set(gen.user_id, existing);
    }

    return Array.from(map.values()).sort(
      (a, b) => b.totalCostThb - a.totalCostThb
    );
  }, [filtered, profileLabels]);

  const totals = useMemo(() => {
    return {
      count: filtered.length,
      tokens: filtered.reduce((s, g) => s + g.total_tokens, 0),
      cost: filtered.reduce((s, g) => s + Number(g.cost_thb), 0),
    };
  }, [filtered]);

  function exportCsv() {
    const header = "ผู้ใช้,จำนวนรูป,Total Tokens,ค่าใช้จ่าย (บาท)\n";
    const rows = summaries
      .map(
        (s) =>
          `"${s.label}",${s.count},${s.totalTokens},${s.totalCostThb.toFixed(2)}`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tr-kids-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="page-title !mb-0">รายงานการใช้งาน</h1>
        <Button variant="outline" onClick={exportCsv}>
          Export CSV
        </Button>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>วันที่เริ่ม</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>วันที่สิ้นสุด</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>ผู้ใช้</Label>
          <Select value={userId} onValueChange={(v) => setUserId(v ?? "all")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="ทุกคน">{selectedUserLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกคน</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {formatProfileLabel(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              รูปที่สร้าง (ช่วงที่เลือก)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{totals.count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Token รวม
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {totals.tokens.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              ค่าใช้จ่ายรวม (บาท)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">
              {totals.cost.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {summaries.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>กราฟค่าใช้จ่ายต่อผู้ใช้</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summaries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip
                  formatter={(value) =>
                    typeof value === "number"
                      ? `${value.toFixed(2)} บาท`
                      : value
                  }
                />
                <Bar dataKey="totalCostThb" fill="oklch(0.52 0.16 255)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {summaries.length === 0 ? (
        <p className="text-muted-foreground">ไม่มีข้อมูลในช่วงที่เลือก</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ผู้ใช้</TableHead>
                <TableHead>จำนวนรูป</TableHead>
                <TableHead>Total Tokens</TableHead>
                <TableHead className="text-right">ค่าใช้จ่าย (บาท)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaries.map((s) => (
                <TableRow key={s.userId}>
                  <TableCell>{s.label}</TableCell>
                  <TableCell>{s.count}</TableCell>
                  <TableCell>{s.totalTokens.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-medium">
                    {s.totalCostThb.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
