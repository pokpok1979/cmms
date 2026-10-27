import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
import { db, connection } from "../src/lib/db";
try {
  const d = await db();
  const orphanLocations = await d
    .collection("locations")
    .aggregate([
      {
        $lookup: {
          from: "sites",
          localField: "siteId",
          foreignField: "_id",
          as: "building",
        },
      },
      { $match: { "building.0": { $exists: false } } },
      { $count: "count" },
    ])
    .next();
  const result = {
    companiesExists:
      (await d.listCollections({ name: "companies" }).toArray()).length > 0,
    buildings: await d.collection("sites").countDocuments({ deletedAt: null }),
    locationsWithoutFloor: await d
      .collection("locations")
      .countDocuments({ floor: { $exists: false } }),
    orphanLocations: orphanLocations?.count || 0,
  };
  console.log(JSON.stringify(result));
  if (
    !result.companiesExists ||
    result.locationsWithoutFloor ||
    result.orphanLocations
  )
    process.exitCode = 1;
} finally {
  await connection().close();
}
