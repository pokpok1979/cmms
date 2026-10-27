//import { loadEnvConfig } from "@next/env";
//loadEnvConfig(process.cwd());
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

import { db, connection, Row } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
const names = [
  "users",
  "roles",
  "companies",
  "sites",
  "locations",
  "maintenanceTeams",
  "assets",
  "workTypes",
  "assetMeterReadings",
  "repairRequests",
  "workOrders",
  "workLogs",
  "downtimeEvents",
  "pmTemplates",
  "pmPlans",
  "pmOccurrences",
  "pmResults",
  "spareParts",
  "sparePartTransactions",
  "attachments",
  "comments",
  "notifications",
  "auditLogs",
  "documentSequences",
  "systemSettings",
  "smtpSettings",
  "sessions",
  "rateLimits",
];
async function main() {
  const d = await db();
  for (const name of names) {
    if (!(await d.listCollections({ name }).toArray()).length)
      await d.createCollection(name);
  }
  await d.collection("workTypes").createIndex({companyId:1,siteId:1,nameKey:1},{name:"workTypes_active_name",unique:true,partialFilterExpression:{deletedAt:null}});
  await d.collection("users").createIndex({ username: 1 }, { unique: true });
  await d.collection("locations").createIndex({siteId:1});
  await d
    .collection("sessions")
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await d
    .collection("rateLimits")
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  for (const name of ["repairRequests", "workOrders"]) {
    await d.collection(name).createIndex({ number: 1 }, { unique: true });
    await d
      .collection(name)
      .createIndex({ companyId: 1, siteId: 1, status: 1, createdAt: -1 });
  }
  await d
    .collection("repairRequests")
    .createIndex({ requesterId: 1, idempotencyKey: 1 }, { unique: true });
  await d
    .collection("workOrders")
    .createIndex({ requestId: 1 }, { unique: true });
  await d
    .collection("assets")
    .createIndex({ companyId: 1, siteId: 1, code: 1 }, { unique: true });
  await d
    .collection("pmOccurrences")
    .createIndex({ planId: 1, assetId: 1, cycle: 1 }, { unique: true });
  await d.collection("workLogs").createIndex({ workOrderId: 1, at: 1 });
  await d
    .collection("workLogs")
    .createIndex({ workOrderId: 1, idempotencyKey: 1 }, { unique: true });
  await d.collection("auditLogs").createIndex({ entityId: 1, at: 1 });
  await d.collection("notifications").createIndex({ recipientId: 1, at: -1 });
  await d
    .collection("sparePartTransactions")
    .createIndex({ idempotencyKey: 1 }, { unique: true, sparse: true });
  const scoped = [
    "locations",
    "workTypes",
    "assets",
    "repairRequests",
    "workOrders",
    "workLogs",
    "attachments",
    "comments",
    "notifications",
    "auditLogs",
  ];
  for (const name of scoped)
    await d.command({
      collMod: name,
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["_id", "companyId", "siteId", ...(name === "locations" ? ["floor"] : [])],
          properties: {
            _id: { bsonType: "string" },
            companyId: { bsonType: "string" },
            siteId: { bsonType: "string" },
            ...(name === "locations" ? {floor:{bsonType:"string"}} : {}),
          },
        },
      },
      validationLevel: "strict",
      validationAction: "error",
    });
  if (!process.env.SEED_PASSWORD || process.env.SEED_PASSWORD.length < 12)
    throw new Error("Set SEED_PASSWORD >= 12 characters");
  await d.collection<Row>("companies").updateOne({_id:"DEMO"},{$setOnInsert:{name:"Demo",nameTh:"Demo",deletedAt:null,revision:0}},{upsert:true});
  const grants = [{ companyId: "DEMO", siteId: "SITE01" }];
  await d.collection<Row>("sites").updateOne(
    { _id: "SITE01" },
    {
      $setOnInsert: {
        companyId: "DEMO",
        siteId: "SITE01",
        name: "โรงงานตัวอย่าง / สำนักงาน",
        deletedAt: null,
      },
    },
    { upsert: true },
  );
  await d.collection<Row>("locations").updateOne(
    { _id: "LOC01" },
    {
      $setOnInsert: {
        companyId: "DEMO",
        siteId: "SITE01",
        name: "อาคาร A ชั้น 1 ห้องเครื่อง",
        deletedAt: null,
      },
    },
    { upsert: true },
  );
  await d.collection<Row>("assets").updateOne(
    { _id: "ASSET01" },
    {
      $setOnInsert: {
        companyId: "DEMO",
        siteId: "SITE01",
        locationId: "LOC01",
        code: "AC-001",
        name: "เครื่องปรับอากาศห้องเครื่อง",
        brand: "ตัวอย่าง",
        model: "Demo",
        status: "active",
        deletedAt: null,
      },
    },
    { upsert: true },
  );
  for (const role of [
    "admin",
    "supervisor",
    "technician",
    "requester",
    "executive",
  ]) {
    await d.collection<Row>("users").updateOne(
      { _id: role },
      {
        $setOnInsert: {
          username: role,
          name: (
            {
              admin: "ผู้ดูแลระบบ",
              supervisor: "หัวหน้าซ่อมบำรุง",
              technician: "ช่างตัวอย่าง",
              requester: "ผู้แจ้งตัวอย่าง",
              executive: "ผู้บริหารตัวอย่าง",
            } as Record<string, string>
          )[role],
          role,
          department: "แผนกทั่วไป",
          grants,
          active: true,
          passwordHash: hashPassword(process.env.SEED_PASSWORD),
        },
      },
      { upsert: true },
    );
  }
  console.log(
    "Indexes, validators and Thai demo masters ready. No operational mock records.",
  );
}
main().finally(() => connection().close());

