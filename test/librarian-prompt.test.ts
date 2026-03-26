import assert from "node:assert/strict";
import test from "node:test";

import { buildLibrarianPrompt, normalizeLibrarianResult } from "../src/librarian/prompt.js";

test("buildLibrarianPrompt includes task, hints, and the public research dossier", () => {
  const prompt = buildLibrarianPrompt({
    task: "Trace how oracle is registered",
    files: ["extensions/mimir/index.ts", "src/oracle/tool.ts"],
    repos: ["badlogic/pi-mono"],
    constraints: "Analysis only.",
    degraded: true,
    publicPasses: [
      {
        pass: 1,
        phase: "repo-hints",
        summary: "Inspected 1 hinted public repo.",
        queries: ["badlogic/pi-mono"],
        evidenceCount: 2,
      },
    ],
    publicEvidence: [
      {
        kind: "public-code",
        title: "badlogic/pi-mono README",
        location: "https://github.com/badlogic/pi-mono/blob/main/README.md",
        citation: "https://github.com/badlogic/pi-mono/blob/main/README.md",
        excerpt: "Pi exposes extension APIs from TypeScript entrypoints.",
        pass: 1,
      },
    ],
    researchLimitations: ["Public search was unavailable, so only hinted repo evidence was gathered."],
  });

  assert.match(prompt, /## Task\nTrace how oracle is registered/);
  assert.match(prompt, /- extensions\/mimir\/index.ts/);
  assert.match(prompt, /## Repo hints\n- badlogic\/pi-mono/);
  assert.match(prompt, /## Public research status/);
  assert.match(prompt, /degraded or partial/i);
  assert.match(prompt, /Citation: https:\/\/github.com\/badlogic\/pi-mono\/blob\/main\/README.md/);
  assert.match(prompt, /Public search was unavailable/);
});

test("normalizeLibrarianResult parses findings, evidence, citations, and degraded labeling", () => {
  const text = `## Findings
Oracle is registered by the extension entrypoint and public package docs mirror that contract.

## Evidence
- extensions/mimir/index.ts:5 registers createOracleTool.
- https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/extensions/types.ts describes the extension API.

## Limitations
Evidence is partial because remote search was unavailable beyond one public repo.`;

  const result = normalizeLibrarianResult(text);
  assert.match(result.findings, /public package docs/);
  assert.match(result.evidence, /extensions\/mimir\/index.ts:5/);
  assert.deepEqual(result.citations, [
    "extensions/mimir/index.ts:5",
    "https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/extensions/types.ts",
  ]);
  assert.equal(result.degraded, true);
  assert.match(result.limitations, /partial/);
});
