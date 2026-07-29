import assert from "node:assert/strict";
import test from "node:test";

import { evaluateAudit } from "./audit-production.mjs";

const allowedAdvisory = {
  source: 12345,
  name: "react-router",
  severity: "high",
  title: "React Router RSC Mode CSRF Bypass",
  url: "https://github.com/advisories/GHSA-qwww-vcr4-c8h2",
};

test("allows only the documented React Router RSC advisory", () => {
  const result = evaluateAudit({
    vulnerabilities: {
      "react-router": {
        severity: "high",
        via: [allowedAdvisory],
      },
      "react-router-dom": {
        severity: "high",
        via: ["react-router"],
      },
    },
  });

  assert.equal(result.blocked.length, 0);
  assert.equal(result.allowed.length, 2);
});

test("blocks another high-severity advisory", () => {
  const result = evaluateAudit({
    vulnerabilities: {
      postcss: {
        severity: "high",
        via: [
          {
            source: 67890,
            severity: "high",
            title: "Path traversal",
            url: "https://github.com/advisories/GHSA-r28c-9q8g-f849",
          },
        ],
      },
    },
  });

  assert.equal(result.allowed.length, 0);
  assert.equal(result.blocked.length, 1);
  assert.equal(result.blocked[0].advisory, "GHSA-R28C-9Q8G-F849");
});

test("blocks an allowlisted advisory when reported for another package", () => {
  const result = evaluateAudit({
    vulnerabilities: {
      "unexpected-package": {
        severity: "high",
        via: [allowedAdvisory],
      },
    },
  });

  assert.equal(result.allowed.length, 0);
  assert.equal(result.blocked.length, 1);
});

test("ignores findings below high severity", () => {
  const result = evaluateAudit({
    vulnerabilities: {
      "body-parser": {
        severity: "low",
        via: [
          {
            source: 11111,
            severity: "low",
            title: "Low-severity finding",
            url: "https://github.com/advisories/GHSA-v422-hmwv-36x6",
          },
        ],
      },
    },
  });

  assert.deepEqual(result, { allowed: [], blocked: [] });
});
