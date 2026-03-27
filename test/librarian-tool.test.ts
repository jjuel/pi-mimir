import assert from "node:assert/strict";
import test from "node:test";

import { createLibrarianCommand, createLibrarianTool } from "../src/librarian/tool.js";

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

test("librarian slash command reuses the librarian runtime and posts a visible result", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const messages: Array<Record<string, unknown>> = [];
  const notifications: Array<{ message: string; type: string | undefined }> = [];

  const command = createLibrarianCommand({
    getThinkingLevel: () => "high",
    sendMessage(message) {
      messages.push(message as unknown as Record<string, unknown>);
    },
    run: async (input, deps) => {
      calls.push(input as unknown as Record<string, unknown>);
      deps?.onProgress?.({ phase: "researching", summary: "Librarian is widening to public web sources." });
      return {
        text: "## Findings\nThe oracle tool is wired through the extension entrypoint.",
        details: {
          role: "librarian",
          task: input.task,
          filesUsed: input.files || [],
          repoHints: input.repos || [],
          constraints: input.constraints || "",
          model: input.model.id,
          findings: "The oracle tool is wired through the extension entrypoint.",
          evidence: "- extensions/mimir/index.ts:6 registers createOracleTool.",
          limitations: "Evidence is sufficient for this question.",
          citations: ["extensions/mimir/index.ts:6"],
          degraded: false,
          sources: [],
          passes: [],
          researchLimitations: [],
        },
      };
    },
  });

  await command.handler("Trace the oracle registration path", {
    cwd: "/tmp/project",
    model: { id: "test-model", provider: "test-provider" },
    modelRegistry: { authStorage: { kind: "auth" } },
    isIdle: () => true,
    waitForIdle: async () => {},
    ui: {
      notify(message: string, type?: string) {
        notifications.push({ message, type });
      },
      setStatus() {},
      setWidget() {},
    },
  } as never);

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.thinkingLevel, "high");
  assert.equal(calls[0]?.task, "Trace the oracle registration path");
  assert.deepEqual(calls[0]?.repos, []);
  assert.equal(messages.length, 3);
  assert.equal(messages[0]?.customType, "mimir-command-progress");
  assert.match(String(messages[0]?.content ?? ""), /^\/librarian running…$/);
  assert.equal(messages[1]?.customType, "mimir-command-progress");
  assert.match(String(messages[1]?.content ?? ""), /Librarian is widening to public web sources\./);
  assert.match(String(messages[2]?.content ?? ""), /## \/librarian/);
  assert.match(String(messages[2]?.content ?? ""), /oracle tool is wired through the extension entrypoint/);
  assert.equal(notifications.some((entry) => /\/librarian completed\./i.test(entry.message)), true);
});
