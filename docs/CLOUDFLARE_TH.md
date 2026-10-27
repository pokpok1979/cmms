# Deploy CMMS บน Cloudflare Workers

โปรเจกต์ใช้ Next.js + API จึงใช้ Workers และ OpenNext ไม่ใช่การอัปโหลด static files ไป Pages
ไฟล์ตั้งค่าและ dependency ถูกเพิ่มแล้ว แต่ต้องทดสอบ Workers runtime และฐานข้อมูลจริงก่อนเปิดใช้งาน

## 1. ตรวจ build

ใช้ Node.js 24 และรัน:

```powershell
npm ci
npm run typecheck
npm run cf:build
```

OpenNext รองรับ Windows แบบจำกัด หาก build บน Windows ไม่ผ่าน ให้ทดสอบบน Linux/WSL หรือ Cloudflare Builds
อย่าใส่รหัสผ่านลงในไฟล์ที่ commit

## 2. ส่งไฟล์ตั้งค่าขึ้น GitHub

ตรวจ `git diff` แล้ว commit และ push ไฟล์ที่เปลี่ยนแปลง

## 3. เชื่อม GitHub

ใน Cloudflare Dashboard เลือก Workers & Pages → Create application → เชื่อม Git repository
เลือก `pokpok1979/cmms`, branch `main` และใช้ Workers ไม่ใช่ Pages

- Worker name: `cmms` (ตรงกับ wrangler.jsonc และ WORKER_SELF_REFERENCE)
- Root directory: โฟลเดอร์รากของ repository
- Build command: `npm run cf:build`
- Deploy command: `npx opennextjs-cloudflare deploy`
- Build variable: `NODE_VERSION=24`

ชื่อเมนูอาจแตกต่างตามหน้า Dashboard

## 4. ตั้งค่า runtime Variables and Secrets

ใน Settings ของ Worker ตั้งค่า:

| ชื่อ | ค่า |
| --- | --- |
| MONGODB_URI | Secret: connection string ของ MongoDB ที่ Worker เข้าถึงได้ |
| MONGODB_DB | ชื่อฐานข้อมูล เช่น cmms |
| APP_URL | URL จริงของ Worker เช่น https://cmms.YOUR-SUBDOMAIN.workers.dev |
| R2_ENDPOINT | Endpoint ของ R2 ถ้าใช้แนบไฟล์ |
| R2_BUCKET | ชื่อ bucket สำหรับไฟล์แนบ |
| R2_ACCESS_KEY_ID | Secret: key ของ R2 |
| R2_SECRET_ACCESS_KEY | Secret: secret ของ R2 |
| LDAP_ENCRYPTION_KEY | Secret: ใช้ค่าเดิมถ้ามีการบันทึกรหัส LDAP/SMTP ไว้แล้ว |
| SMTP_ENCRYPTION_KEY | Secret: ใช้ค่าเดิมถ้าตั้งแยกไว้ |

APP_URL ต้องตรงกับเว็บที่เปิดจริง เพราะระบบตรวจ Origin ตอนบันทึกข้อมูล
ไม่ต้องเพิ่ม NEXT_PUBLIC_ ให้ตัวแปรเหล่านี้
ไม่ต้องตั้ง SEED_PASSWORD บน Worker; ใช้เฉพาะตอน setup ฐานข้อมูล
อย่าเปลี่ยน encryption key เดิมโดยไม่ย้ายข้อมูลที่เข้ารหัสไว้

MongoDB ต้องรองรับ transactions และอนุญาตการเชื่อมต่อจาก Cloudflare ตาม network policy ที่เลือก
ถ้าใช้ฐานข้อมูลเดิม จะใช้ข้อมูลชุดเดียวกับบนเครื่องและมีผลต่อข้อมูลจริง
ถ้าใช้ฐานข้อมูลใหม่ ให้รัน setup ตามคู่มือติดตั้งกับฐานข้อมูลนั้นก่อน โดยตรวจ MONGODB_DB ให้ถูกต้อง

## 5. ตรวจหลัง deploy

1. เปิดเว็บและหน้า login
2. ทดลอง login หลายครั้งและเปิดพร้อมกันสอง browser sessions เพื่อตรวจ connection scope
3. ตรวจ dashboard, สร้างรายการทดสอบ และบันทึกข้อมูลที่ใช้ transaction
4. ทดลองแนบและเปิดรูปจาก R2
5. ตรวจ Workers logs เมื่อพบข้อผิดพลาด

โค้ดแยก MongoDB client ต่อ request ใน Workers และปิดหลัง response stream จบ
การรัน Node.js ปกติยังใช้ connection ร่วมกันได้
ยังต้องทดสอบการเชื่อมต่อ MongoDB และความเข้ากันได้ของ LDAP/SMTP ใน Workers จริง
LDAP ที่อยู่บน IP ภายในองค์กรต้องมีการเชื่อมเครือข่ายเพิ่มเติม; Worker ไม่เห็น LAN โดยอัตโนมัติ

## งานอัตโนมัติ

`npm run pm:worker` และ `npm run notifications:worker` ไม่ถูกเรียกจากการ deploy เว็บ
ต้องรันบน Node.js server/scheduler แยก หรือพัฒนา scheduled handler/queue สำหรับ Workers เพิ่มเติม
อย่าตั้งค่า Cron Trigger โดยคาดว่าจะเรียกสคริปต์ npm เหล่านี้เอง

## อ้างอิง

- https://opennext.js.org/cloudflare/get-started
- https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/
- https://developers.cloudflare.com/workers/databases/third-party-integrations/mongodb/
