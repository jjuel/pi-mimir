import assert from "node:assert/strict";
import test from "node:test";

import { createLibrarianTool } from "../src/librarian/tool.js";

test("librarian tool forwards parent model context and returns evidence details", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];

  const tool = createLibrarianTool({
    getThinkingLevel: () => "high",
    run: async (input, deps) => {
      calls.push(input as unknown as Record<string, unknown>);
      deps?.onProgress?.({ phase: "researching", summary: "Librarian is widening to public web sources." });
      return {
        text: "## Findings\nThe oracle tool is wired through the extension entrypoint and public docs confirm the extension contract.\n\n## Evidence\n- extensions/mimir/index.ts:6 registers createOracleTool.\n- https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/extensions/types.ts describes ExtensionAPI.\n\n## Limitations\nEvidence is sufficient for this question.",
        details: {
          role: "librarian",
          task: input.task,
          filesUsed: input.files || [],
          repoHints: input.repos || [],
          constraints: input.constraints || "",
          model: input.model.id,
          findings: "The oracle tool is wired through the extension entrypoint and public docs confirm the extension contract.",
          evidence: "- extensions/mimir/index.ts:6 registers createOracleTool.",
          limitations: "Evidence is sufficient for this question.",
          citations: [
            "extensions/mimir/index.ts:6",
            "https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/extensions/types.ts",
          ],
          degraded: false,
          sources: [],
          passes: [],
          researchLimitations: [],
        },
      };
    },
  });

  const result = await tool.execute(
    "tool-call-1",
    {
      task: "Trace the oracle registration path",
      files: ["extensions/mimir/index.ts"],
      repos: ["badlogic/pi-mono"],
      constraints: "Use public docs only when local evidence is insufficient.",
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
  assert.deepEqual(calls[0]?.repos, ["badlogic/pi-mono"]);
  assert.equal(result.details.role, "librarian");
  assert.deepEqual((result.details as { citations: string[] }).citations, [
    "extensions/mimir/index.ts:6",
    "https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/extensions/types.ts",
  ]);
  assert.equal(updates.length >= 2, true);
  assert.equal(
    updates.some((update) => JSON.stringify(update).includes("public web sources")),
    true,
  );
});
