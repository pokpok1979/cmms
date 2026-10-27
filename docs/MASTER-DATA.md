# โครงสร้างข้อมูลหลัก

- `companies` เก็บบริษัท มีเมนู “บริษัท” ให้ Admin เพิ่ม แก้ไข และลบ
- บริษัทใหม่สร้างโรงงาน/สาขาเริ่มต้นและเพิ่มสิทธิ์ให้ Admin ผู้สร้าง
- `sites` ใช้ในเมนู “อาคาร/โรงงาน” และสัมพันธ์กับ `locations.siteId` แบบ 1:M
- `locations.floor` เก็บชั้นเป็นข้อความ
- `users.departmentId` อ้างอิง `departments._id` แบบ 1:M
- การลบบริษัทตรวจข้อมูลและผู้ใช้งานอ้างอิงก่อน และต้องเหลือบริษัทอื่นในขอบเขตสิทธิ์
- ข้อมูลบริษัทเดิมกู้กลับจากโปรไฟล์ใน `systemSettings` ด้วย `node --import tsx scripts/restore-companies.ts` (รันซ้ำได้)
- `scripts/migrate-masters.ts` ปรับความสัมพันธ์และชั้น โดยเก็บตารางบริษัทไว้
- ตรวจฐานข้อมูล: `node --import tsx scripts/verify-masters.ts`
