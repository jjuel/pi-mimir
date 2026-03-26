import assert from "node:assert/strict";
import test from "node:test";

import { buildOracleSessionOptions, runOracleSubagent } from "../src/oracle/runtime.js";

test("buildOracleSessionOptions inherits the parent model and thinking level", () => {
  const fakeModel = { id: "test-model", provider: "test-provider" };
  const fakeLoader = { reload: async () => {} };
  const fakeRegistry = { authStorage: { kind: "auth" } };

  const options = buildOracleSessionOptions({
    cwd: "/tmp/project",
    model: fakeModel as never,
    thinkingLevel: "high",
    authStorage: fakeRegistry.authStorage as never,
    modelRegistry: fakeRegistry as never,
    resourceLoader: fakeLoader as never,
  });

  assert.equal(options.cwd, "/tmp/project");
  assert.equal(options.model, fakeModel);
  assert.equal(options.thinkingLevel, "high");
  assert.equal(options.authStorage, fakeRegistry.authStorage);
  assert.equal(options.modelRegistry, fakeRegistry);
  assert.equal(options.resourceLoader, fakeLoader);
  assert.equal(Array.isArray(options.tools), true);
  assert.deepEqual(options.tools?.map((tool) => tool.name), ["read", "grep", "find", "ls"]);
});

test("runOracleSubagent prompts an isolated session and returns structured details", async () => {
  const fakeMessages = [
    {
      role: "assistant",
      content: [
        {
          type: "text",
          text: `## Conclusion\nThe runtime should stay read-only.\n\n## Reasoning\nIt reduces risk while establishing the subagent contract.\n\n## Risks\nThe prompt may be too rigid.\n\n## Recommendation\nShip oracle first and reuse the runtime later.\n\n## Limitations\nThis answer used a fake test session.`,
        },
      ],
    },
  ];

  const seen: {
    prompt: string | null;
    options: unknown;
    disposed: boolean;
  } = {
    prompt: null,
    options: null,
    disposed: false,
  };

  const firstMessage = fakeMessages[0]!;

  const createSession = async (options: unknown) => {
    seen.options = options;
    return {
      session: {
        messages: fakeMessages,
        subscribe(listener: (event: { type: string; toolName?: string; message?: { role?: string } }) => void) {
          listener({ type: "tool_execution_start", toolName: "read" });
          listener({ type: "message_end", message: firstMessage });
          return () => {};
        },
        async prompt(prompt: string) {
          seen.prompt = prompt;
        },
        dispose() {
          seen.disposed = true;
        },
      },
    };
  };

  const result = await runOracleSubagent(
    {
      cwd: "/tmp/project",
      model: { id: "test-model", provider: "test-provider" } as never,
      thinkingLevel: "medium",
      authStorage: { kind: "auth" } as never,
      modelRegistry: { authStorage: { kind: "auth" } } as never,
      task: "Review the first slice architecture",
      files: ["src/oracle/runtime.ts"],
      constraints: "Read-only analysis only.",
    },
    {
      createSession: createSession as never,
      createLoader: async () => ({ reload: async () => {} }) as never,
    },
  );

  assert.match(seen.prompt ?? "", /Review the first slice architecture/);
  assert.match(seen.prompt ?? "", /src\/oracle\/runtime.ts/);
  assert.equal((seen.options as { model: { id: string } }).model.id, "test-model");
  assert.equal((seen.options as { thinkingLevel: string }).thinkingLevel, "medium");
  assert.equal(result.details.role, "oracle");
  assert.equal(result.details.conclusion, "The runtime should stay read-only.");
  assert.equal(result.details.recommendation, "Ship oracle first and reuse the runtime later.");
  assert.equal(seen.disposed, true);
});
