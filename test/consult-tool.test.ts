import assert from "node:assert/strict";
import test from "node:test";

import { createConsultCommand, createConsultTool } from "../src/consult/tool.js";

test("consult tool forwards parent context, mode, and returns unified details", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];

  const tool = createConsultTool({
    getThinkingLevel: () => "high",
    run: async (input, deps) => {
      calls.push(input as unknown as Record<string, unknown>);
      deps?.onProgress?.({ phase: "routing", summary: "Consult selected the oracle route." });
      return {
        text: "## Summary\nOracle-only route ran.\n\n## Specialists Used\n- Requested mode: oracle\n- Effective mode: oracle\n- oracle\n\n## Advice\n**Conclusion:** Oracle-only route ran.\n\n**Reasoning:** Forced mode was respected.\n\n**Risks:** No librarian evidence was gathered.\n\n**Recommendation:** Use both when you want research plus advice.\n\n## Limitations\n- Forced oracle mode skips librarian.",
        details: {
          role: "consult",
          task: input.task,
          mode: input.mode || "automatic",
          effectiveMode: "oracle",
          localFirst: true,
          needsRemoteResearch: false,
          routingReason: "The user explicitly forced oracle mode.",
          filesUsed: input.files || [],
          repoHints: input.repos || [],
          constraints: input.constraints || "",
          model: input.model.id,
          specialistsUsed: ["oracle"],
          stageStatus: { librarian: "skipped", oracle: "succeeded" },
          stageErrors: [],
          compactEvidence: [],
          evidenceCitations: [],
          degraded: false,
          partial: false,
          summary: "Oracle-only route ran.",
          oracle: {
            role: "oracle",
            task: input.task,
            filesUsed: input.files || [],
            constraints: input.constraints || "",
            model: input.model.id,
            conclusion: "Oracle-only route ran.",
            reasoning: "Forced mode was respected.",
            risks: "No librarian evidence was gathered.",
            recommendation: "Use both when you want research plus advice.",
            limitations: "Forced oracle mode skips librarian.",
            degraded: false,
          },
        },
      };
    },
  });

  const result = await tool.execute(
    "tool-call-1",
    {
      task: "Route directly to oracle",
      files: ["extensions/mimir/index.ts"],
      repos: ["badlogic/pi-mono"],
      constraints: "Analysis only.",
      mode: "oracle",
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
  assert.equal(calls[0]?.mode, "oracle");
  assert.deepEqual(calls[0]?.files, ["extensions/mimir/index.ts"]);
  assert.deepEqual(calls[0]?.repos, ["badlogic/pi-mono"]);
  assert.equal(result.details.role, "consult");
  assert.deepEqual((result.details as { specialistsUsed: string[] }).specialistsUsed, ["oracle"]);
  assert.equal(updates.length >= 2, true);
  assert.equal(updates.some((update) => JSON.stringify(update).includes("selected the oracle route")), true);
});

test("consult slash command reuses the consult runtime and posts a visible result", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const messages: Array<Record<string, unknown>> = [];
  const notifications: Array<{ message: string; type: string | undefined }> = [];

  const command = createConsultCommand({
    getThinkingLevel: () => "high",
    sendMessage(message) {
      messages.push(message as unknown as Record<string, unknown>);
    },
    run: async (input, deps) => {
      calls.push(input as unknown as Record<string, unknown>);
      deps?.onProgress?.({ phase: "routing", summary: "Consult selected the oracle route." });
      return {
        text: "## Summary\nOracle-only route ran.",
        details: {
          role: "consult",
          task: input.task,
          mode: input.mode || "automatic",
          effectiveMode: "oracle",
          localFirst: true,
          needsRemoteResearch: false,
          routingReason: "The user asked for advisory guidance.",
          filesUsed: input.files || [],
          repoHints: input.repos || [],
          constraints: input.constraints || "",
          model: input.model.id,
          specialistsUsed: ["oracle"],
          stageStatus: { librarian: "skipped", oracle: "succeeded" },
          stageErrors: [],
          compactEvidence: [],
          evidenceCitations: [],
          degraded: false,
          partial: false,
          summary: "Oracle-only route ran.",
          oracle: {
            role: "oracle",
            task: input.task,
            filesUsed: input.files || [],
            constraints: input.constraints || "",
            model: input.model.id,
            conclusion: "Oracle-only route ran.",
            reasoning: "Forced mode was respected.",
            risks: "No librarian evidence was gathered.",
            recommendation: "Use both when you want research plus advice.",
            limitations: "Forced oracle mode skips librarian.",
            degraded: false,
          },
        },
      };
    },
  });

  await command.handler("Recommend the best default entrypoint", {
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
  assert.equal(calls[0]?.mode, "automatic");
  assert.equal(calls[0]?.task, "Recommend the best default entrypoint");
  assert.equal(messages.length, 3);
  assert.equal(messages[0]?.customType, "mimir-command-progress");
  assert.match(String(messages[0]?.content ?? ""), /^\/consult running…$/);
  assert.equal(messages[1]?.customType, "mimir-command-progress");
  assert.match(String(messages[1]?.content ?? ""), /Consult selected the oracle route\./);
  assert.match(String(messages[2]?.content ?? ""), /## \/consult/);
  assert.match(String(messages[2]?.content ?? ""), /Oracle-only route ran/);
  assert.equal(notifications.some((entry) => /\/consult completed\./i.test(entry.message)), true);
});
