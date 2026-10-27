import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
import { db, connection, type Row } from "../src/lib/db";
// Run once when deploying the LDAP profile change. Preserve existing names first.
try {
  const d = await db();
  for (const account of await d
    .collection<Row>("users")
    .find({ departmentId: { $exists: true } })
    .toArray()) {
    if (!account.department) {
      const department = await d
        .collection<Row>("departments")
        .findOne({ _id: account.departmentId });
      await d
        .collection<Row>("users")
        .updateOne(
          { _id: account._id },
          { $set: { department: department?.name || "" } },
        );
    }
  }
  await d.collection("users").updateMany({}, { $unset: { departmentId: "" } });
  await d
    .collection("ldapSettings")
    .updateMany({}, { $unset: { departmentId: "" } });
  if ((await d.listCollections({ name: "departments" }).toArray()).length)
    await d.collection("departments").drop();
  console.log(
    "Preserved user departments and removed the department master collection.",
  );
} finally {
  await connection().close();
}
