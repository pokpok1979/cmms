const fs = require("node:fs");
const path = require("node:path");
const file = path.resolve("src/app/page.tsx");
if (!fs.existsSync("package.json") || !fs.existsSync(file)) {
  throw new Error(
    "Run this script from the cmms folder containing package.json.",
  );
}
let source = fs.readFileSync(file, "utf8");
if (/import\s+AdminUsers\s+from/.test(source)) {
  console.log("AdminUsers is already connected. No page changes made.");
  process.exit(0);
}
const usersStart = source.search(
  /\{view\s*===\s*["']users["']\s*&&\s*u\.role\s*===\s*["']admin["']\s*&&\s*\(/,
);
const profileMatch = /\{view\s*===\s*["']profile["']\s*&&\s*\(/g;
profileMatch.lastIndex = Math.max(0, usersStart);
const next = profileMatch.exec(source);
const generic =
  /\[([^\]]*["']repairRequests["'][^\]]*["']users["'][^\]]*["']auditLogs["'][^\]]*)\]\.includes\(view\)/;
if (usersStart < 0 || !next || !generic.test(source)) {
  throw new Error(
    "Cannot identify the existing user form/list. No changes made. Provide the latest page.tsx for integration.",
  );
}
const component = `{view === "users" && u.role === "admin" && (
  <AdminUsers currentUser={u} sites={look.sites} onSaved={(requiresLogin) => {
    if (requiresLogin) { setU(null); setSuccess(""); }
    else { api("me").then(setU).catch(() => setU(null)); }
  }} />
)}\n              `;
source = source.slice(0, usersStart) + component + source.slice(next.index);
source = source.replace(
  generic,
  (match, body) =>
    "[" + body.replace(/["']users["']\s*,?\s*/, "") + "]" + ".includes(view)",
);
source = source.replace(
  /(import\s+.*?from\s+["']react["'];?)/,
  '$1\nimport AdminUsers from "./AdminUsers";',
);
if (!source.includes("import AdminUsers"))
  throw new Error("Cannot identify React import. No changes made.");
source = source.replace(
  /else if\s*\(view\s*===\s*["']profile["']\)\s*return;/,
  'else if (view === "profile" || view === "users") return;',
);
source = source.replace(
  /hidden=\{view\s*===\s*["']dashboard["']\}/,
  'hidden={["dashboard", "users"].includes(view)}',
);
source = source.replace(
  /style=\{view\s*===\s*["']dashboard["']\s*\?\s*\{\s*display\s*:\s*["']none["']\s*\}\s*:\s*undefined\}/,
  'style={["dashboard", "users"].includes(view) ? {display:"none"} : undefined}',
);
source = source.replaceAll('label="ชื่อแสดงผล"', 'label="ชื่อ-นามสกุล"');
const backup = file + ".before-admin-users-" + Date.now() + ".bak";
fs.copyFileSync(file, backup);
fs.writeFileSync(file, source, "utf8");
console.log("Connected AdminUsers. Backup:", path.basename(backup));
