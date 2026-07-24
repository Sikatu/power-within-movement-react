import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const ALLOWED_ADVISORIES = new Map([
  [
    "GHSA-QWWW-VCR4-C8H2",
    {
      packages: new Set(["react-router", "react-router-dom"]),
      reason:
        "The affected unstable React Server Components APIs are not used by this Vite client application.",
    },
  ],
]);

const severityRank = {
  info: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

function parseArguments(args) {
  const options = {
    auditDirectory: ".",
    inputPath: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--prefix") {
      options.auditDirectory = args[index + 1];
      index += 1;
      continue;
    }

    if (argument === "--input") {
      options.inputPath = args[index + 1];
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  if (!options.auditDirectory || (args.includes("--input") && !options.inputPath)) {
    throw new Error("A value is required after --prefix or --input.");
  }

  return options;
}

function advisoryId(via) {
  const text = `${via.source ?? ""} ${via.url ?? ""} ${via.title ?? ""}`;
  return text.match(/GHSA-[a-z0-9-]+/i)?.[0]?.toUpperCase() ?? null;
}

function resolveAdvisories(packageName, vulnerabilities, visited = new Set()) {
  if (visited.has(packageName)) {
    return [];
  }

  const vulnerability = vulnerabilities[packageName];
  if (!vulnerability) {
    return [];
  }

  const nextVisited = new Set(visited);
  nextVisited.add(packageName);

  return (vulnerability.via ?? []).flatMap((via) => {
    if (typeof via === "string") {
      return resolveAdvisories(via, vulnerabilities, nextVisited);
    }

    return [{ packageName, via }];
  });
}

export function evaluateAudit(report) {
  const vulnerabilities = report?.vulnerabilities;
  if (!vulnerabilities || typeof vulnerabilities !== "object") {
    throw new Error("npm audit returned an unsupported JSON structure.");
  }

  const highRiskPackages = Object.entries(vulnerabilities).filter(
    ([, vulnerability]) =>
      (severityRank[vulnerability.severity] ?? -1) >= severityRank.high,
  );

  const allowed = [];
  const blocked = [];

  for (const [packageName] of highRiskPackages) {
    const advisories = resolveAdvisories(packageName, vulnerabilities);

    if (advisories.length === 0) {
      blocked.push({
        packageName,
        advisory: "unresolved",
        title: "No advisory details were available",
      });
      continue;
    }

    for (const advisory of advisories) {
      const id = advisoryId(advisory.via);
      const policy = id ? ALLOWED_ADVISORIES.get(id) : null;
      const affectedPackages = new Set([packageName, advisory.packageName]);

      if (
        policy &&
        [...affectedPackages].every((name) => policy.packages.has(name))
      ) {
        allowed.push({
          packageName,
          advisory: id,
          reason: policy.reason,
        });
      } else {
        blocked.push({
          packageName,
          advisory: id ?? "unknown",
          title: advisory.via.title ?? "High-severity production vulnerability",
        });
      }
    }
  }

  return { allowed, blocked };
}

function loadAuditReport(options) {
  if (options.inputPath) {
    return JSON.parse(readFileSync(options.inputPath, "utf8"));
  }

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(
    npmCommand,
    [
      "audit",
      "--omit=dev",
      "--audit-level=high",
      "--json",
      ...(options.auditDirectory === "."
        ? []
        : ["--prefix", options.auditDirectory]),
    ],
    {
      encoding: "utf8",
      shell: process.platform === "win32",
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (!result.stdout.trim()) {
    throw new Error(result.stderr.trim() || "npm audit returned no JSON output.");
  }

  return JSON.parse(result.stdout);
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const report = loadAuditReport(options);
  const result = evaluateAudit(report);

  for (const item of result.allowed) {
    console.log(
      `Allowed ${item.advisory} for ${item.packageName}: ${item.reason}`,
    );
  }

  if (result.blocked.length > 0) {
    console.error("Blocking production dependency vulnerabilities:");
    for (const item of result.blocked) {
      console.error(
        `- ${item.packageName}: ${item.advisory} — ${item.title}`,
      );
    }
    process.exitCode = 1;
    return;
  }

  console.log("Production dependency audit policy passed.");
}

if (process.argv[1] && import.meta.url === new URL(`file:${process.argv[1]}`).href) {
  main();
}
