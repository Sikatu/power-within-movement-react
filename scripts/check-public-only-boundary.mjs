import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { extname } from "node:path";

const tracked = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard"],
  { encoding: "utf8" },
)
  .split(/\r?\n/)
  .filter(Boolean);

const failures = [];

const forbiddenPaths = [
  /^server\//i,
  /^src\/pages\/admin\//i,
  /^src\/components\/admin\//i,
  /ClientPortal/i,
  /NotificationCenter/i,
  /^\.env\.local\.example$/i,
  /^\.env\.production\.example$/i,
];

for (const file of tracked) {
  for (const pattern of forbiddenPaths) {
    if (pattern.test(file)) {
      failures.push(`Forbidden private-system path remains: ${file}`);
      break;
    }
  }
}

const textExtensions = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".css",
  ".html",
  ".md",
  ".txt",
  ".xml",
  ".yml",
  ".yaml",
  ".sh",
]);

const forbiddenContent = [
  "VITE_API_BASE_URL",
  "localhost:8787",
  "npm --prefix server",
  "nativeApi",
  "pwc_client_token",
  "pwc_admin_token",
  "AdminFrame",
  "AdminRouteGuard",
  "/client-portal",
  "/admin/",
  "server/src/",
  "server/package.json",
  "Express backend",
  "PostgreSQL backend",
  "portal experiences",
];

for (const file of tracked) {
  if (!textExtensions.has(extname(file).toLowerCase())) {
    continue;
  }

  if (file === "scripts/check-public-only-boundary.mjs") {
    continue;
  }

  let source;

  try {
    source = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  for (const token of forbiddenContent) {
    if (source.includes(token)) {
      failures.push(
        `Forbidden private-system reference "${token}" remains in ${file}`,
      );
    }
  }
}

if (failures.length) {
  console.error("\nPublic-only architecture audit failed:\n");

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log(
  "Public-only architecture audit passed: repository contains no backend, admin, or client-portal runtime architecture.",
);