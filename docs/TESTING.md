# Test plan / ขอบเขต verification
Automated: scope pairing/empty grants, role/assignment/transition skipping, terminal status, password hash correctness. TypeScript/build ตรวจ compilation ของ frontend/backend.
ยังไม่รัน Atlas/R2/browser UAT เพราะไม่มี credentials และอุปกรณ์จริง.

|UAT|ขั้นตอน|ผลคาดหวัง|
|---|---|---|
|mobile + photo|360px requester สร้าง RR แล้ว upload JPG|ได้ RR unique + private attachment|
|cross scope|บัญชี site2 เรียก ID ของ site1 ทุก endpoint|404/403 ไม่ส่งข้อมูล|
|ownership|requester2 อ่าน RR ของ requester1; ช่างอื่นอ่าน WO|404|
|workflow|pending→approve→assign→accept→start→log→review→complete→close|audit ครบ; role ผิดถูกปฏิเสธ|
|concurrency|ส่ง approve สองครั้งพร้อม revision เดียว|WO หนึ่งใบ; อีก request 409|
|document sequence|สร้าง 50 RR พร้อมกันคนละ key|50 เลขไม่ซ้ำ; sequence atomic|
|dedupe|ส่ง create key เดิมซ้ำ/พร้อมกัน|หนึ่ง RR; retry ได้หรือ conflict แล้วอ่านผล|
|close guard|พยายาม close WO ยัง review|400 ไม่เปลี่ยนคำขอ|
|cost|log 123.45 บาทสองรายการ|24690 satang; Audit ต้นทุนครบ|
|attachment|ผิด type/ใหญ่/คนนอก scope|ปฏิเสธ; bucket private|
|QR|สแกน QR AC-001 หลัง login|asset ASSET01; แจ้งซ่อมเติมสถานที่ถูกต้อง|
|responsive|360/768/1440px keyboard + touch|ไม่มีฟอร์มล้น, focus ชัด, counters reduced motion|
|password|เปลี่ยนรหัสจาก profile|sessions ทุกอุปกรณ์ invalid|
|PM/KPI|ยังไม่รองรับ|ไม่ผ่านเกณฑ์ระยะ 2/3 จนกว่าจะพัฒนาและทดสอบ|

## ผลที่รันในสภาพแวดล้อมส่งมอบ
- `npm run typecheck`: ผ่าน
- `npm test`: 5 ผ่าน / 0 ล้มเหลว
- `npm run build`: ผ่าน Next.js 16.4.0 production build
- ยังไม่รัน browser/Atlas/R2/concurrency integration tests; ตารางข้างต้นเป็นแผน UAT ไม่ใช่ผลผ่าน
