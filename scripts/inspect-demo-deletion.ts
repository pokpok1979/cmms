import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
import { db, connection, Row } from "../src/lib/db";
try {
  const d = await db();
  const companies = await d
    .collection<Row>("companies")
    .find(
      { _id: { $regex: "^Demo$", $options: "i" } },
      { projection: { name: 1, nameTh: 1, deletedAt: 1 } },
    )
    .toArray();
  console.log(JSON.stringify({ companies }));
  for (const c of companies) {
    const counts: Record<string, number> = {};
    for (const n of await d.listCollections({}, { nameOnly: true }).toArray()) {
      const count = await d
        .collection(n.name)
        .countDocuments({ companyId: c._id });
      if (count) counts[n.name] = count;
    }
    console.log(
      JSON.stringify({
        id: c._id,
        counts,
        usersWithGrant: await d
          .collection("users")
          .countDocuments({ "grants.companyId": c._id }),
        usersWithOnlyThisCompany: await d
          .collection("users")
          .countDocuments({
            "grants.companyId": c._id,
            grants: { $not: { $elemMatch: { companyId: { $ne: c._id } } } },
          }),
      }),
    );
  }
} finally {
  await connection().close();
}
