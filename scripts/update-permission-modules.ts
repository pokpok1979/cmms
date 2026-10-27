import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
import { randomUUID } from "node:crypto";
import { connection, tx, type Row } from "../src/lib/db";
import { resolvePermissions, modules } from "../src/lib/permissions";
import { userRoles } from "../src/lib/admin-users-policy";

try {
  const result = await tx(async (d, session) => {
    const admin = await d
      .collection<Row>("users")
      .findOne(
        { role: "admin", active: true, "grants.0": { $exists: true } },
        { session },
      );
    if (!admin)
      throw Error(
        "No active administrator with a scope is available for the migration audit",
      );
    const updated: string[] = [];
    for (const role of userRoles) {
      const old = await d
        .collection<Row>("rolePermissions")
        .findOne({ _id: role }, { session });
      // Resolving the old policy inherits its settings restrictions for the two new modules.
      const matrix = resolvePermissions(role, old?.matrix);
      if (old && JSON.stringify(old.matrix) === JSON.stringify(matrix))
        continue;
      await d
        .collection<Row>("rolePermissions")
        .updateOne(
          { _id: role },
          {
            $set: {
              matrix,
              updatedAt: new Date(),
              updatedBy: "system:permission-modules",
            },
            $inc: { revision: 1 },
          },
          { upsert: true, session },
        );
      await d
        .collection<Row>("auditLogs")
        .insertOne(
          {
            _id: randomUUID(),
            ...admin.grants[0],
            entityId: role,
            entityType: "roles",
            actorId: "system:permission-modules",
            actorName: "ระบบปรับปรุงโมดูลสิทธิ์",
            event: "roles.updated",
            reference: role,
            at: new Date(),
            detail: {
              before: old?.matrix || {},
              after: matrix,
              note: "เพิ่มโมดูล LDAP / AD และ SMTP โดยคงข้อจำกัดสิทธิ์เดิม",
            },
          },
          { session },
        );
      updated.push(role);
    }
    return { updatedRoles: updated, moduleCount: modules.length };
  });
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Permission migration failed",
  );
  process.exitCode = 1;
} finally {
  await connection().close();
}
