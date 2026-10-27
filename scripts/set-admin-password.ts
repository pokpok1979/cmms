import nextEnv from "@next/env";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { randomBytes, scryptSync } from "node:crypto";
import { MongoClient } from "mongodb";

nextEnv.loadEnvConfig(process.cwd(), true);

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("ไม่พบ MONGODB_URI");

  const rl = createInterface({ input: stdin, output: stdout });
  let password: string;

  try {
    password = await rl.question("รหัสผ่านใหม่ของ admin: ");
    const confirm = await rl.question("ยืนยันรหัสผ่าน: ");

    if (password.length < 12) {
      throw new Error("รหัสผ่านต้องมีอย่างน้อย 12 ตัวอักษร");
    }

    if (password !== confirm) {
      throw new Error("รหัสผ่านไม่ตรงกัน");
    }
  } finally {
    rl.close();
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();

    const db = client.db(process.env.MONGODB_DB || "cmms");
    const users = db.collection<{
      _id: string;
      username: string;
      role: string;
      passwordHash: string;
    }>("users");
    const admin = await users.findOne({ username: "admin" });

    if (!admin || admin.role !== "admin") {
      throw new Error("ไม่พบบัญชี admin ที่มีสิทธิ์ผู้ดูแลระบบ");
    }

    const salt = randomBytes(16).toString("hex");
    const passwordHash =
      salt + ":" + scryptSync(password, salt, 64).toString("hex");

    await users.updateOne({ _id: admin._id }, { $set: { passwordHash } });

    // ยกเลิก session เดิมของ admin
    await db.collection("sessions").deleteMany({
      userId: admin._id,
    });

    console.log("ตั้งรหัสผ่าน admin สำเร็จ");
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "ดำเนินการไม่สำเร็จ");
  process.exitCode = 1;
});
