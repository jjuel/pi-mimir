import assert from "node:assert/strict";
import test from "node:test";

import { createOracleCommand, createOracleTool } from "../src/oracle/tool.js";

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

test("oracle slash command reuses the oracle runtime and posts a visible result", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const messages: Array<Record<string, unknown>> = [];
  const notifications: Array<{ message: string; type: string | undefined }> = [];
  let widgetCalls = 0;
  let waited = false;

  const command = createOracleCommand({
    getThinkingLevel: () => "high",
    sendMessage(message) {
      messages.push(message as unknown as Record<string, unknown>);
    },
    run: async (input, deps) => {
      calls.push(input as unknown as Record<string, unknown>);
      deps?.onProgress?.({ phase: "synthesizing", summary: "Oracle is synthesizing advice." });
      return {
        text: "## Conclusion\nUse the runtime.",
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

  await command.handler("Review the current runtime layout", {
    cwd: "/tmp/project",
    model: { id: "test-model", provider: "test-provider" },
    modelRegistry: { authStorage: { kind: "auth" } },
    isIdle: () => false,
    waitForIdle: async () => {
      waited = true;
    },
    ui: {
      notify(message: string, type?: string) {
        notifications.push({ message, type });
      },
      setStatus() {
        throw new Error("should not use footer status for slash command progress");
      },
      setWidget() {
        widgetCalls += 1;
      },
    },
  } as never);

  assert.equal(waited, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.thinkingLevel, "high");
  assert.equal((calls[0]?.model as { id: string }).id, "test-model");
  assert.equal(calls[0]?.task, "Review the current runtime layout");
  assert.deepEqual(calls[0]?.files, []);
  assert.equal(calls[0]?.constraints, "");
  assert.equal(messages.length, 3);
  assert.equal(messages[0]?.customType, "mimir-command-progress");
  assert.match(String(messages[0]?.content ?? ""), /^\/oracle running…$/);
  assert.equal(messages[1]?.customType, "mimir-command-progress");
  assert.match(String(messages[1]?.content ?? ""), /Oracle is synthesizing advice\./);
  assert.equal(messages[2]?.customType, "mimir-command-result");
  assert.match(String(messages[2]?.content ?? ""), /## \/oracle/);
  assert.match(String(messages[2]?.content ?? ""), /Use the runtime/);
  assert.equal(notifications.some((entry) => /Waiting for the current agent turn/i.test(entry.message)), true);
  assert.equal(notifications.some((entry) => /\/oracle completed\./i.test(entry.message)), true);
  assert.equal(widgetCalls, 0);
});

test("oracle slash command shows usage when no task is provided", async () => {
  const notifications: Array<{ message: string; type: string | undefined }> = [];
  let ran = false;

  const command = createOracleCommand({
    getThinkingLevel: () => "high",
    sendMessage() {
      throw new Error("should not send a message");
    },
    run: async () => {
      ran = true;
      throw new Error("should not run");
    },
  });

  await command.handler("   ", {
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

  assert.equal(ran, false);
  assert.deepEqual(notifications, [{ message: "Usage: /oracle <task>", type: "warning" }]);
});
