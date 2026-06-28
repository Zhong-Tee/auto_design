"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const urlError = searchParams.get("error");
  const inactiveError = urlError === "inactive";
  const authError = urlError === "auth";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      setLoading(false);
      return;
    }

    await fetch("/api/auth/bootstrap", { method: "POST" });

    router.push("/");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md border-primary/20 shadow-lg shadow-primary/10">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-3xl brand-gradient-text">TR Kids</CardTitle>
        <CardDescription className="text-base">
          เข้าสู่ระบบเพื่อสร้างรูป AI
        </CardDescription>
      </CardHeader>
      <CardContent>
        {inactiveError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription className="text-base">
              บัญชีถูกปิดการใช้งาน กรุณาติดต่อผู้ดูแลระบบ
            </AlertDescription>
          </Alert>
        )}
        {authError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription className="text-base">
              การเข้าสู่ระบบล้มเหลว กรุณาลองใหม่
            </AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription className="text-base">{error}</AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">อีเมล</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">รหัสผ่าน</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="h-11"
            />
          </div>
          <Button type="submit" className="h-11 w-full text-base" disabled={loading}>
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function LoginPageContent() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <LoginForm />
    </div>
  );
}
