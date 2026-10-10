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

## คิวสร้างภาพ (Worker)

ก่อนใช้คิวรุ่นนี้ ให้หยุดเซิร์ฟเวอร์รุ่นเก่าและรอให้งานที่กำลังสร้างสิ้นสุด จากนั้นรัน
`supabase/migrations/012_reliable_generation_queue.sql` ใน Supabase SQL Editor
(ต้องรัน migrations 004–011 ที่ยังไม่ได้รันก่อนด้วย) แล้วเริ่มเซิร์ฟเวอร์ใหม่
หากมีเลขออเดอร์เดียวกันที่กำลังทำงานซ้ำอยู่ SQL จะไม่สร้าง unique index ให้ ต้องตรวจสอบงานเหล่านั้นก่อน
ไฟล์ SQL ทำงานใน transaction จึงไม่ทิ้ง schema ที่เปลี่ยนไปเพียงบางส่วนเมื่อเกิดข้อผิดพลาด

- `npm run dev` และ `npm start` เปิดเว็บพร้อม Worker แยก process บน Node server
- `npm run worker` เปิด Worker แยกต่างหากได้; โหลดค่าจาก `.env.local` เช่นเดียวกับเว็บ
- `npm run dev:web` / `npm run start:web` เปิดเฉพาะเว็บ เมื่อใช้ process manager ดูแล Worker แยก
- บน serverless ให้ deploy Worker ไปยังเครื่อง/container ที่ทำงานต่อเนื่องและตั้ง restart policy
  คำขอเว็บไม่สร้างภาพใน `after()` และไม่ต้องอยู่จนภาพเสร็จ
- Worker หลายตัวใช้ฐานข้อมูลเดียวกันได้ การจองงานและจำกัด 2 งานพร้อมกันอยู่ใน transaction เดียว
- Worker ส่ง heartbeat ทุก 15 วินาที งานขาด heartbeat เกิน 3 นาทีจะจบเป็นข้อผิดพลาด
  เมื่อ Worker ตรวจคิวรอบถัดไป ไม่ส่งงานที่ผลไม่แน่นอนกลับเข้า AI อัตโนมัติ
- เวลาสูงสุดรวมของแต่ละงานคือ 25 นาที; API รอได้ 10 นาทีต่อครั้ง คุณภาพ/ขนาดยังคงเดิม
- ปิด SDK retry และลองใหม่ได้อีกครั้งเฉพาะ HTTP 429/503 โดยเคารพ Retry-After
  การหมดเวลารอ/เน็ตหลุดไม่เรียกสร้างซ้ำ เพราะคำขอเดิมอาจถูกประมวลผลแล้ว
- ปุ่มยกเลิกหยุดงานรอคิวได้ทันที งานที่กำลังทำจะหยุดรอเมื่อ Worker ตรวจ heartbeat
  งานที่ส่งถึงผู้ให้บริการแล้วอาจยังทำงานหรือคิดค่าบริการ แต่ไม่บันทึกผลกลับมาทับสถานะยกเลิก
- หลังเน็ตหลุดตอนส่งคำขอ ใช้ “ตรวจสอบคำขอเดิม” เพื่อค้นหางานด้วย request id เดิม
- หน้าคิวแสดงขั้นตอน/จำนวนครั้งที่ลอง และแจ้งเมื่อขาดการเชื่อมต่อหรือรอ Worker นาน
- ดู logs ที่ขึ้นต้น `[queue-worker]` และ `[generate]` สำหรับ job id, ขั้นตอน และเวลา API/รวม
- ตรวจด้วย `npm run test:queue`, `node tests/transparency.cjs`, และ `npx tsc --noEmit`

ฐานข้อมูลของแอปไม่มีสิทธิ์รัน DDL ผ่าน REST จึงต้องรัน migration ด้วยบัญชีเจ้าของฐานข้อมูล
ก่อนเปิด Worker ตรวจให้แน่ใจว่าเซิร์ฟเวอร์รุ่นเก่าหยุดแล้ว เพื่อไม่ให้คิวสองรุ่นทำงานพร้อมกัน

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
