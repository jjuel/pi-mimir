import assert from "node:assert/strict";
import test from "node:test";

import { buildLibrarianSessionOptions, runLibrarianSubagent } from "../src/librarian/runtime.js";

test("buildLibrarianSessionOptions inherits the parent model and local read-only tools", () => {
  const fakeModel = { id: "test-model", provider: "test-provider" };
  const fakeLoader = { reload: async () => {} };
  const fakeRegistry = { authStorage: { kind: "auth" } };

  const options = buildLibrarianSessionOptions({
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
  assert.deepEqual(options.tools?.map((tool) => tool.name), ["read", "grep", "find", "ls"]);
});

test("runLibrarianSubagent prompts an isolated local-only session and returns evidence details", async () => {
  const fakeMessages = [
    {
      role: "assistant",
      content: [
        {
          type: "text",
          text: `## Findings\nThe current extension exposes oracle but not yet consult.\n\n## Evidence\n- extensions/mimir/index.ts:6 registers the oracle tool.\n- README.md:5 lists oracle as the current slice.\n\n## Limitations\nEvidence is strong for the local registration path, but this answer did not inspect future planned tools beyond the current repo state.`,
        },
      ],
    },
  ];

  const firstMessage = fakeMessages[0]!;
  const seen: {
    prompt: string | null;
    options: unknown;
    disposed: boolean;
  } = {
    prompt: null,
    options: null,
    disposed: false,
  };

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

  const result = await runLibrarianSubagent(
    {
      cwd: "/tmp/project",
      model: { id: "test-model", provider: "test-provider" } as never,
      thinkingLevel: "medium",
      authStorage: { kind: "auth" } as never,
      modelRegistry: { authStorage: { kind: "auth" } } as never,
      task: "Explain what tools the extension currently exposes",
      files: ["extensions/mimir/index.ts", "README.md"],
      repos: ["badlogic/pi-mono"],
      constraints: "Use local context only.",
    },
    {
      createSession: createSession as never,
      createLoader: async () => ({ reload: async () => {} }) as never,
    },
  );

  assert.match(seen.prompt ?? "", /Explain what tools the extension currently exposes/);
  assert.match(seen.prompt ?? "", /extensions\/mimir\/index.ts/);
  assert.match(seen.prompt ?? "", /badlogic\/pi-mono/);
  assert.equal((seen.options as { model: { id: string } }).model.id, "test-model");
  assert.equal((seen.options as { thinkingLevel: string }).thinkingLevel, "medium");
  assert.equal(result.details.role, "librarian");
  assert.match(result.details.findings, /oracle/);
  assert.deepEqual(result.details.citations, ["extensions/mimir/index.ts:6", "README.md:5"]);
  assert.equal(result.details.degraded, false);
  assert.equal(seen.disposed, true);
});
