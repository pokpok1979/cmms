import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
import { db, connection, Row } from "../src/lib/db";
async function main() {
  const d = await db();
  let count = 0;
  for (const id of await d
    .collection("sites")
    .distinct("companyId", { deletedAt: null })) {
    const profile = await d
      .collection<Row>("systemSettings")
      .findOne(
        { companyId: id, companyNameTh: { $type: "string", $ne: "" } },
        { sort: { updatedAt: -1 } },
      );
    const r = await d
      .collection<Row>("companies")
      .updateOne(
        { _id: id },
        {
          $setOnInsert: {
            name: profile?.companyNameTh || id,
            nameTh: profile?.companyNameTh || id,
            nameEn: profile?.companyNameEn || "",
            phone: profile?.phone || "",
            email: profile?.email || "",
            website: profile?.website || "",
            address: profile?.address || "",
            revision: 0,
            deletedAt: null,
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );
    count += r.upsertedCount;
  }
  console.log(
    JSON.stringify({
      restored: count,
      total: await d
        .collection("companies")
        .countDocuments({ deletedAt: null }),
    }),
  );
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => connection().close());
