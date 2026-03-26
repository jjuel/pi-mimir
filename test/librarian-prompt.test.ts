import assert from "node:assert/strict";
import test from "node:test";

import { buildLibrarianPrompt, normalizeLibrarianResult } from "../src/librarian/prompt.js";

test("buildLibrarianPrompt includes task, file hints, repo hints, and constraints", () => {
  const prompt = buildLibrarianPrompt({
    task: "Trace how oracle is registered",
    files: ["extensions/mimir/index.ts", "src/oracle/tool.ts"],
    repos: ["badlogic/pi-mono"],
    constraints: "Use local context only.",
  });

  assert.match(prompt, /## Task\nTrace how oracle is registered/);
  assert.match(prompt, /- extensions\/mimir\/index.ts/);
  assert.match(prompt, /- src\/oracle\/tool.ts/);
  assert.match(prompt, /## Repo hints\n- badlogic\/pi-mono/);
  assert.match(prompt, /## Constraints\nUse local context only\./);
});

test("normalizeLibrarianResult parses findings, evidence, citations, and degraded labeling", () => {
  const text = `## Findings\nOracle is registered by the extension entrypoint.\n\n## Evidence\n- extensions/mimir/index.ts:5 registers createOracleTool.\n- src/oracle/tool.ts:37 defines the public oracle tool.\n\n## Limitations\nEvidence is partial because only the local registration path was inspected.`;

  const result = normalizeLibrarianResult(text);
  assert.equal(result.findings, "Oracle is registered by the extension entrypoint.");
  assert.match(result.evidence, /extensions\/mimir\/index.ts:5/);
  assert.deepEqual(result.citations, ["extensions/mimir/index.ts:5", "src/oracle/tool.ts:37"]);
  assert.equal(result.degraded, true);
  assert.match(result.limitations, /partial/);
});
