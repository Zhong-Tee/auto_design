import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureBootstrapAdmin } from "@/lib/auth/bootstrap-admin";

async function requireAdminApi() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin" || !profile.is_active) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user };
}

export async function GET() {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "ไม่สามารถโหลดข้อมูลผู้ใช้ได้" }, { status: 500 });
  }

  return NextResponse.json({ users: data });
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const { email, password, display_name, role } = body as {
    email?: string;
    password?: string;
    display_name?: string;
    role?: "admin" | "user";
  };

  if (!email || !password) {
    return NextResponse.json({ error: "กรุณากรอกอีเมลและรหัสผ่าน" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: authData, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name },
    });

  if (createError || !authData.user) {
    return NextResponse.json(
      { error: "ไม่สามารถสร้างผู้ใช้ได้ อีเมลอาจถูกใช้แล้ว" },
      { status: 400 }
    );
  }

  await ensureBootstrapAdmin(authData.user.id, authData.user.email);

  if (role === "admin") {
    await admin.from("profiles").update({ role: "admin" }).eq("id", authData.user.id);
  }

  if (display_name) {
    await admin
      .from("profiles")
      .update({ display_name })
      .eq("id", authData.user.id);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", authData.user.id)
    .single();

  return NextResponse.json({ user: profile });
}

export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const { id, password, role, is_active, display_name } = body as {
    id?: string;
    password?: string;
    role?: "admin" | "user";
    is_active?: boolean;
    display_name?: string;
  };

  if (!id) {
    return NextResponse.json({ error: "ไม่พบ user id" }, { status: 400 });
  }

  const admin = createAdminClient();

  if (password) {
    const { error } = await admin.auth.admin.updateUserById(id, { password });
    if (error) {
      return NextResponse.json({ error: "ไม่สามารถรีเซ็ตรหัสผ่านได้" }, { status: 400 });
    }
  }

  const updates: Record<string, unknown> = {};
  if (role !== undefined) updates.role = role;
  if (is_active !== undefined) updates.is_active = is_active;
  if (display_name !== undefined) updates.display_name = display_name;

  if (Object.keys(updates).length > 0) {
    const { error } = await admin.from("profiles").update(updates).eq("id", id);
    if (error) {
      return NextResponse.json({ error: "ไม่สามารถอัปเดตข้อมูลได้" }, { status: 400 });
    }
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  return NextResponse.json({ user: profile });
}
