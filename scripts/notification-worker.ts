import nextEnv from "@next/env";
import { setTimeout } from "node:timers/promises";
nextEnv.loadEnvConfig(process.cwd());

async function main() {
  const { deliverNotificationEmails } = await import("../src/lib/notification-email");
  const { connection } = await import("../src/lib/db");
  const stop = new AbortController();
  process.once("SIGINT", () => stop.abort());
  process.once("SIGTERM", () => stop.abort());
  try {
    do {
      try { console.log("Notification email:", await deliverNotificationEmails()); }
      catch { console.error("Notification email worker: database unavailable; retrying next cycle"); }
      if (process.argv.includes("--once")) break;
      await setTimeout(30000, undefined, { signal: stop.signal }).catch(() => {});
    } while (!stop.signal.aborted);
  } finally { await connection().close(); }
}
main().catch(() => { console.error("Notification email worker failed"); process.exitCode = 1; });
