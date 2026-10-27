import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
import { db, tx, connection, type Row } from "../src/lib/db";
try {
  const result = await tx(async (d, s) => {
    await d
      .collection<Row>("systemSettings")
      .updateOne(
        { _id: "admin-users-write-lock" },
        { $inc: { revision: 1 } },
        { upsert: true, session: s },
      );
    const settings = await d
      .collection("ldapSettings")
      .updateMany(
        { mode: { $ne: "sync" } },
        {
          $set: { mode: "sync", updatedAt: new Date() },
          $inc: { revision: 1 },
        },
        { session: s },
      );
    // Preserve existing password hashes. New imported accounts have no password until an admin sets one.
    const users = await d
      .collection("users")
      .updateMany(
        { authSource: "ldap" },
        { $set: { authSource: "local", updatedAt: new Date() } },
        { session: s },
      );
    return {
      settingsUpdated: settings.modifiedCount,
      usersUpdated: users.modifiedCount,
    };
  });
  const d = await db();
  console.log(
    JSON.stringify({
      ...result,
      remainingLdapAuth: await d
        .collection("users")
        .countDocuments({ authSource: "ldap" }),
      importedUsersWithoutPassword: await d
        .collection("users")
        .countDocuments({
          ldapCompanyId: { $exists: true },
          $or: [{ passwordHash: { $exists: false } }, { passwordHash: "" }],
        }),
    }),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : "Migration failed");
  process.exitCode = 1;
} finally {
  await connection().close();
}
