import assert from "node:assert/strict";
import test from "node:test";

import { createOracleTool } from "../src/oracle/tool.js";

test("oracle tool forwards parent model context and returns machine-readable details", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];

  const tool = createOracleTool({
    getThinkingLevel: () => "high",
    run: async (input, deps) => {
      calls.push(input as unknown as Record<string, unknown>);
      deps?.onProgress?.({ phase: "synthesizing", summary: "Oracle is synthesizing advice." });
      return {
        text: "## Conclusion\nUse the runtime.\n\n## Reasoning\nIt is reusable.\n\n## Risks\nLow test realism.\n\n## Recommendation\nKeep iterating.\n\n## Limitations\nMocked session.",
        details: {
          role: "oracle",
          task: input.task,
          filesUsed: input.files || [],
          constraints: input.constraints || "",
          model: input.model.id,
          conclusion: "Use the runtime.",
          reasoning: "It is reusable.",
          risks: "Low test realism.",
          recommendation: "Keep iterating.",
          limitations: "Mocked session.",
          degraded: false,
        },
      };
    },
  });

  const result = await tool.execute(
    "tool-call-1",
    {
      task: "Review the package structure",
      files: ["extensions/mimir/index.ts"],
      constraints: "Read-only",
    },
    undefined,
    (update) => updates.push(update as unknown as Record<string, unknown>),
    {
      cwd: "/tmp/project",
      model: { id: "test-model", provider: "test-provider" },
      modelRegistry: { authStorage: { kind: "auth" } },
    } as never,
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.thinkingLevel, "high");
  assert.equal((calls[0]?.model as { id: string }).id, "test-model");
  assert.deepEqual(calls[0]?.files, ["extensions/mimir/index.ts"]);
  assert.equal(result.details.role, "oracle");
  assert.equal((result.details as { recommendation: string }).recommendation, "Keep iterating.");
  assert.equal(updates.length >= 2, true);
});
