# TR Kids – AI Image Generator

เว็บแอปภายในสำหรับสร้างรูป PNG ความละเอียดสูงด้วย OpenAI `gpt-image-2` เก็บรูปที่ Cloudflare R2 และบันทึก log ที่ Supabase

## Tech Stack

- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
- Supabase (Auth, Postgres, RLS)
- Cloudflare R2 (S3-compatible)
- OpenAI Images API (`gpt-image-2`)

## เริ่มต้น

### 1. ติดตั้ง dependencies

```bash
npm install
```

### 2. ตั้งค่า environment

```bash
cp .env.example .env.local
```

กรอกค่าใน `.env.local`:

- Supabase URL, anon key, service role key
- `ADMIN_BOOTSTRAP_EMAIL` — อีเมล admin คนแรก (promote อัตโนมัติเมื่อ sign up/login ถ้ายังไม่มี admin)
- OpenAI API key (Phase สร้างรูป)
- Cloudflare R2 credentials (Phase อัปโหลด/เก็บรูป)

### 3. รัน Supabase migrations

รัน SQL ตามลำดับใน Supabase SQL Editor (หรือ `supabase db push`):

1. `supabase/migrations/001_schema.sql`
2. `supabase/migrations/002_rls_policies.sql`
3. `supabase/migrations/003_seed_settings.sql`

เปิด Email auth ใน Supabase Dashboard

### 4. รัน dev server

```bash
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000)

## Routes

| Route | คำอธบาย |
|-------|----------|
| `/login` | เข้าสู่ระบบ |
| `/` | สร้างรูป |
| `/history` | ประวัติของตัวเอง |
| `/admin/**` | จัดการระบบ (admin เท่านั้น) |

## Admin คนแรก

1. ตั้ง `ADMIN_BOOTSTRAP_EMAIL` ใน `.env.local`
2. Sign up / login ด้วยอีเมลนั้นใน Supabase (หรือสร้างผ่าน Dashboard)
3. ระบบจะ promote เป็น `admin` อัตโนมัติถ้ายังไม่มี admin ในระบบ

## ความปลอดภัย

- ห้าม commit `.env.local`
- OpenAI, R2, service role key ใช้ฝั่ง server เท่านั้น
- `NEXT_PUBLIC_*` อนุญาตเฉพาะ Supabase URL/anon key (+ `R2_PUBLIC_BASE_URL` ถ้าต้องการ)
