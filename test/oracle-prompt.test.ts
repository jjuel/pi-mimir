import assert from "node:assert/strict";
import test from "node:test";

import { buildOraclePrompt, normalizeOracleResult } from "../src/oracle/prompt.js";

test("buildOraclePrompt includes task, focus files, and constraints", () => {
  const prompt = buildOraclePrompt({
    task: "Review the session handoff design",
    files: ["src/runtime.ts", "src/prompts.ts"],
    constraints: "Do not suggest schema changes.",
  });

  assert.match(prompt, /## Task\nReview the session handoff design/);
  assert.match(prompt, /- src\/runtime.ts/);
  assert.match(prompt, /- src\/prompts.ts/);
  assert.match(prompt, /## Constraints\nDo not suggest schema changes\./);
});

test("normalizeOracleResult parses the required advisory sections", () => {
  const text = `## Conclusion\nUse a thin runtime wrapper.\n\n## Reasoning\nIt keeps the deep module stable.\n\n## Risks\nStreaming contracts may drift.\n\n## Recommendation\nStart with a pure runtime builder.\n\n## Limitations\nNo live network validation.`;

  const result = normalizeOracleResult(text);
  assert.equal(result.conclusion, "Use a thin runtime wrapper.");
  assert.equal(result.reasoning, "It keeps the deep module stable.");
  assert.equal(result.risks, "Streaming contracts may drift.");
  assert.equal(result.recommendation, "Start with a pure runtime builder.");
  assert.equal(result.limitations, "No live network validation.");
});
