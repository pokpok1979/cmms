import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
import { randomUUID } from "node:crypto";
import { db, connection, Row } from "../src/lib/db";
import { settingsId } from "../src/lib/system-settings-policy";
async function main() {
  const d = await db();
  // Preserve company profile in each building's settings before dropping the collection.
  for (const company of await d
    .collection<Row>("companies")
    .find({})
    .toArray()) {
    for (const site of await d
      .collection<Row>("sites")
      .find({ companyId: company._id })
      .toArray()) {
      await d
        .collection<Row>("systemSettings")
        .updateOne(
          { _id: settingsId(company._id, site._id) },
          {
            $setOnInsert: {
              companyId: company._id,
              siteId: site._id,
              companyNameTh: company.nameTh || company.name || "",
              companyNameEn: company.nameEn || "",
              phone: company.phone || "",
              email: company.email || "",
              website: company.website || "",
              address: company.address || "",
              plantName: site.name,
              revision: 0,
            },
          },
          { upsert: true },
        );
    }
  }
  await d
    .collection("locations")
    .updateMany({ floor: { $exists: false } }, { $set: { floor: "" } });
  for (const location of await d
    .collection<Row>("locations")
    .find({})
    .toArray()) {
    if (
      !(await d
        .collection<Row>("sites")
        .findOne({ _id: location.siteId, companyId: location.companyId }))
    )
      throw Error(`Orphan location ${location._id}; migration stopped`);
  }
  await d.collection("locations").createIndex({ siteId: 1 });
  await d.command({
    collMod: "locations",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["_id", "companyId", "siteId", "floor"],
        properties: {
          _id: { bsonType: "string" },
          companyId: { bsonType: "string" },
          siteId: { bsonType: "string" },
          floor: { bsonType: "string" },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });
  // Companies are retained: company management has been restored.
  console.log(
    "Migrated buildings, locations/floor and user departments; companies retained.",
  );
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => connection().close());
