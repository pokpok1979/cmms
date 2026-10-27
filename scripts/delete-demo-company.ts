import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
import { db, tx, connection, Row } from "../src/lib/db";
const companyId = "DEMO";
async function main() {
  if (!process.argv.includes("--execute"))
    throw Error("Pass --execute to delete DEMO and its related data");
  const database = await db();
  const names = (
    await database.listCollections({}, { nameOnly: true }).toArray()
  ).map((c) => c.name);
  const result = await tx(async (d, s) => {
    await d
      .collection<Row>("systemSettings")
      .updateOne(
        { _id: "admin-users-write-lock" },
        { $inc: { revision: 1 } },
        { upsert: true, session: s },
      );
    const company = await d
      .collection<Row>("companies")
      .findOne({ _id: companyId }, { session: s });
    if (!company) throw Error("DEMO company does not exist");
    const sites = await d
      .collection<Row>("sites")
      .find({ companyId }, { session: s, projection: { _id: 1 } })
      .toArray();
    const departments = await d
      .collection<Row>("departments")
      .find({ companyId }, { session: s, projection: { _id: 1 } })
      .toArray();
    const departmentIds = departments.map((x) => x._id);
    const affected = await d
      .collection<Row>("users")
      .find(
        {
          $or: [
            { "grants.companyId": companyId },
            { departmentId: { $in: departmentIds } },
          ],
        },
        { session: s, projection: { _id: 1, grants: 1, departmentId: 1 } },
      )
      .toArray();
    const survivingAdmin = await d
      .collection<Row>("users")
      .findOne(
        {
          role: "admin",
          active: true,
          grants: { $elemMatch: { companyId: { $ne: companyId } } },
        },
        { session: s, projection: { _id: 1 } },
      );
    if (!survivingAdmin)
      throw Error(
        "Deletion would leave no active admin with another company scope",
      );
    const deleted: Record<string, number> = {};
    for (const name of names) {
      if (
        ["companies", "users", "sessions", "documentSequences"].includes(name)
      )
        continue;
      const r = await d
        .collection(name)
        .deleteMany({ companyId }, { session: s });
      if (r.deletedCount) deleted[name] = r.deletedCount;
    }
    const grants = await d
      .collection<{
        _id: string;
        grants: { companyId: string; siteId: string }[];
      }>("users")
      .updateMany(
        { "grants.companyId": companyId },
        { $pull: { grants: { companyId } }, $set: { updatedAt: new Date() } },
        { session: s },
      );
    const cleared = await d
      .collection<Row>("users")
      .updateMany(
        { departmentId: { $in: departmentIds } },
        {
          $unset: { departmentId: "", department: "" },
          $set: { updatedAt: new Date() },
        },
        { session: s },
      );
    const sessions = await d
      .collection("sessions")
      .deleteMany(
        { userId: { $in: affected.map((x) => x._id) } },
        { session: s },
      );
    if (sites.length) {
      const patterns = sites.map((site) => ({
        _id: {
          $regex: "^" + site._id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ":",
        },
      }));
      const seq = await d
        .collection<Row>("documentSequences")
        .deleteMany({ $or: patterns }, { session: s });
      if (seq.deletedCount) deleted.documentSequences = seq.deletedCount;
    }
    const removed = await d
      .collection<Row>("companies")
      .deleteOne({ _id: companyId }, { session: s });
    deleted.companies = removed.deletedCount;
    return {
      companyId,
      deleted,
      usersGrantsUpdated: grants.modifiedCount,
      usersDepartmentsCleared: cleared.modifiedCount,
      sessionsRemoved: sessions.deletedCount,
      usersPreserved: affected.length,
    };
  });
  console.log(JSON.stringify(result));
  const remaining: Record<string, number> = {};
  for (const name of names) {
    const count = await database.collection(name).countDocuments({ companyId });
    if (count) remaining[name] = count;
  }
  const companyRemaining = await database
    .collection<Row>("companies")
    .countDocuments({ _id: companyId });
  const grantsRemaining = await database
    .collection("users")
    .countDocuments({ "grants.companyId": companyId });
  console.log(
    JSON.stringify({
      verification: {
        companyRemaining,
        grantsRemaining,
        remainingRelated: remaining,
      },
    }),
  );
  if (companyRemaining || grantsRemaining || Object.keys(remaining).length)
    throw Error("Deletion verification failed");
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => connection().close());
