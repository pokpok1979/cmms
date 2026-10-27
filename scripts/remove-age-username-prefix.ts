import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
import { db, tx, connection, type Row } from "../src/lib/db";
const execute = process.argv.includes("--execute");
try {
  const database = await db();
  const candidates = await database
    .collection<Row>("users")
    .find(
      { username: /^age/i },
      { projection: { username: 1, ldapAccount: 1 } },
    )
    .toArray();
  console.log(JSON.stringify({ candidateCount: candidates.length }));
  const proposed = candidates
    .filter((u) => /^age\./i.test(u.username))
    .map((u) => ({
      _id: u._id,
      from: u.username,
      to: u.username.replace(/^age\./i, ""),
    }));
  const plan: typeof proposed = [];
  const conflicts: typeof proposed = [];
  for (const item of proposed) {
    if (!item.to) throw Error("Empty username after prefix removal");
    if (
      proposed.some(
        (other) =>
          other._id !== item._id &&
          other.to.toLowerCase() === item.to.toLowerCase(),
      )
    )
      throw Error("Duplicate target username in migration");
    if (
      await database
        .collection<Row>("users")
        .findOne({
          _id: { $ne: item._id },
          username: {
            $regex: `^${item.to.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
            $options: "i",
          },
        })
    ) {
      conflicts.push(item);
      continue;
    }
    plan.push(item);
  }
  console.log(JSON.stringify({ execute, updateCount: plan.length, conflicts }));
  if (execute && plan.length) {
    const modified = await tx(async (d, s) => {
      await d
        .collection<Row>("systemSettings")
        .updateOne(
          { _id: "admin-users-write-lock" },
          { $inc: { revision: 1 } },
          { upsert: true, session: s },
        );
      let count = 0;
      for (const item of plan) {
        if (
          await d
            .collection<Row>("users")
            .findOne(
              {
                _id: { $ne: item._id },
                username: {
                  $regex: `^${item.to.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
                  $options: "i",
                },
              },
              { session: s },
            )
        )
          throw Error(`Username collision: ${item.to}`);
        const result = await d
          .collection<Row>("users")
          .updateOne(
            { _id: item._id, username: item.from },
            { $set: { username: item.to, updatedAt: new Date() } },
            { session: s },
          );
        if (result.modifiedCount !== 1)
          throw Error("Account changed during migration");
        count += result.modifiedCount;
      }
      return count;
    });
    const remaining = await database
      .collection<Row>("users")
      .countDocuments({
        $or: plan.map((item) => ({ _id: item._id, username: item.from })),
      });
    console.log(
      JSON.stringify({ modified, remainingPrefixedUsers: remaining }),
    );
    if (remaining) throw Error("Verification failed");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Migration failed");
  process.exitCode = 1;
} finally {
  await connection().close();
}
