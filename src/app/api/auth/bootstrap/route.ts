import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureBootstrapAdmin } from "@/lib/auth/bootstrap-admin";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  await ensureBootstrapAdmin(user.id, user.email);
  return NextResponse.json({ ok: true });
}
