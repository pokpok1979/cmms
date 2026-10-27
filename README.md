# CMMS — MVP ระยะที่ 1

อ่าน docs/DESIGN.md ก่อน: แบบระบบ, assumptions, data model, permission matrix และ workflow.

## Windows + VS Code

1. ติดตั้ง Node.js 24 LTS, เปิดโฟลเดอร์ cmms ด้วย VS Code.
2. Terminal PowerShell: `npm ci`
3. `Copy-Item .env.example .env.local` แล้วกรอก MONGODB_URI, MONGODB_DB, APP_URL. Atlas database user ต้องอ่านเขียนฐานข้อมูลได้; setup ต้องสร้าง index/collMod ได้; อนุญาต IP ของเครื่องและ server. URI URL-encode password. ใช้ replica set ที่รองรับ transaction.
4. ตั้ง SEED_PASSWORD อย่างน้อย 12 ตัวอักษร (ไม่มีรหัสจริงในไฟล์ส่งมอบ). `npm run setup` สร้าง indexes, validators, ข้อมูลสถานที่/asset และบัญชี admin, supervisor, technician, requester, executive. seed rerun ไม่ reset รหัสเดิม.
5. `npm run dev` เปิด http://localhost:3000 แล้วเข้าด้วย User ID และ SEED_PASSWORD. เปลี่ยนรหัสผ่านแต่ละบัญชีก่อนใช้จริง; บัญชี seed ใช้สำหรับ UAT เท่านั้น.
6. `npm test`, `npm run typecheck`, `npm run build`, `npm start`.

## R2

สร้าง private bucket, S3 API token จำกัด bucket, ตั้ง R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY. อัปโหลดผ่าน API ของ Next.js จึงไม่ต้องเปิด bucket public หรือ CORS browser-to-R2. จำกัด JPG/PNG/PDF 8 MB ตรวจ magic bytes; ยังไม่มี malware scanning. ไฟล์ดาวน์โหลด signed URL 60 วินาทีหลังตรวจสิทธิ์. Server/reverse proxy ต้องรับ multipart 9 MB แต่ควรจำกัด request ก่อนอ่าน body. metadata authorization ใน MongoDB; R2 custom metadata มี parent ID. D1 metadata mirror ยังไม่รองรับตาม DESIGN.

## Deploy

ใช้ Node.js hosting/VPS/Docker บน HTTPS ที่ต่อ Atlas และ R2 ได้ (ไม่ใช้ static export หรือ Workers แบบ TCP ไม่ได้). `npm ci`, `npm run build`, `npm start`; ตั้ง PORT=3000, NODE_ENV=production, APP_URL เป็น HTTPS origin จริง และ env ผ่าน secret manager. ไม่ commit .env.local. ตั้ง process manager auto-restart, proxy HTTPS, จำกัด body 9 MB, rate-limit IP /api/login ที่ proxy เพิ่มเติมจาก username limit ใน MongoDB. อนุญาต Atlas IP เฉพาะ server. Backup Atlas + R2 และทดสอบ restore. รัน setup ครั้งเดียวก่อนเริ่ม app. Lockfile ระบุเวอร์ชันที่ตรวจ build แล้ว.

## Scheduler

ระยะที่ 1 ไม่มี PM scheduler หรือ email sender; in-app notification สร้างใน transaction เมื่อมอบหมายและเปลี่ยนสถานะ. ไม่อ้างว่า scheduler PM ทำงานแล้ว. ระยะ 2 ให้ external scheduler เรียก Node worker ทุก 5 นาทีแม้เว็บปิด: lease + occurrence unique key + transaction + outbox. คำสั่ง scheduler จะส่งมอบเมื่อพัฒนา worker จริง; ไม่สร้าง placeholder ที่แสดงว่าเสร็จแล้ว.

## ส่งมอบแล้ว

Login opaque session httpOnly/TTL, scrypt password, role + paired scope backend, CSRF Origin, username rate limit, Zod, Thai responsive dashboard/counters, master location/asset creation, asset history + QR link, request creation/dedupe + photo upload, approve→WO, assignment, technician workflow/log/cost, supervisor review, requester rating/closure gate, comment/audit, private attachments, user creation/profile/password/session revocation, online manifest.

## ข้อจำกัดที่ยังต้องพัฒนา

ยังไม่มี browser QR scanner ใน app (ใช้กล้องมือถือสแกน QR ที่เปิด URL ได้), หลายช่างใน UI (API รับหลายคน), master/user edit/disable/soft-delete UI, org hierarchy/configurable workflows/SLA/number UI, asset warranty/meter management, การซ่อมฉุกเฉินก่อนอนุมัติ, separate material/contractor costs และ inventory, downtime/KPI/export, PM/scheduler/checklist/defect, email/Teams/LINE, Microsoft SSO, Cloudflare D1 metadata mirror, offline sync/service worker และ install icons PNG. ไม่มี fallback mock DB. เงินใน work log เป็นยอดรวม satang ระยะ 1; ไม่ใช่ stock transaction. ไม่ถือว่าระยะ 1 ครบ requirement ทุกหัวข้อ.

## หลักฐานการทดสอบ

ดู docs/TESTING.md; build/unit ไม่ทดแทน UAT ฐานข้อมูลและอุปกรณ์จริง. ยังไม่ได้ deploy production หรือใส่ credentials.

## เวอร์ชันที่ build ผ่าน

Node.js 24.19.0, Next.js 16.4.0, React/React DOM 19.3.0, MongoDB Driver 7.7.0, Zod 4.6.6, Tailwind 4.3.3, TypeScript 7.0.2. package.json pin เวอร์ชันจริงและ package-lock.json เก็บ dependency tree. ตรวจเอกสาร compatibility จาก Next.js installation และ MongoDB Node driver docs แล้ว; ต้องทดสอบ Atlas deployment ขององค์กรเพิ่มเติม.
