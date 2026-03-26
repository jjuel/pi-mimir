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

test("runLibrarianSubagent combines public research with isolated local synthesis", async () => {
  const fakeMessages = [
    {
      role: "assistant",
      content: [
        {
          type: "text",
          text: `## Findings
The current extension exposes oracle and librarian, and the public docs confirm Pi extensions register tools from TypeScript entrypoints.

## Evidence
- extensions/mimir/index.ts:6 registers the oracle tool.
- extensions/mimir/index.ts:12 registers the librarian tool.
- https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/extensions/types.ts documents the extension API.

## Limitations
Evidence is sufficient for the extension surface, though public search was partial beyond the hinted repo.`,
        },
      ],
    },
  ];

  const firstMessage = fakeMessages[0]!;
  const seen: {
    prompt: string | null;
    options: unknown;
    disposed: boolean;
    progress: string[];
  } = {
    prompt: null,
    options: null,
    disposed: false,
    progress: [],
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
      constraints: "Use local context plus public docs only.",
    },
    {
      createSession: createSession as never,
      createLoader: async () => ({ reload: async () => {} }) as never,
      createResearch: async (_input, deps) => {
        deps?.onProgress?.({ phase: "repo-hints", summary: "Librarian is inspecting hinted public repositories." });
        return {
          evidence: [
            {
              kind: "public-code",
              title: "Pi extension API types",
              location: "https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/extensions/types.ts",
              citation: "https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/extensions/types.ts",
              excerpt: "ExtensionAPI exposes registerTool().",
              pass: 1,
            },
          ],
          passes: [
            {
              pass: 1,
              phase: "repo-hints",
              summary: "Inspected 1 hinted public repo.",
              queries: ["badlogic/pi-mono"],
              evidenceCount: 1,
            },
          ],
          limitations: ["Public search was partial beyond the hinted repo."],
          degraded: false,
          repoHintsUsed: ["badlogic/pi-mono"],
          webQueries: ["Explain what tools the extension currently exposes"],
          budget: {
            maxPasses: 3,
            maxRepoHints: 2,
            maxCodeFilesPerRepo: 2,
            maxDocsPages: 2,
            maxWebQueries: 2,
            maxResultsPerQuery: 3,
            maxWebPages: 2,
            maxEvidence: 8,
          },
        };
      },
      onProgress(progress) {
        seen.progress.push(progress.summary);
      },
    },
  );

  assert.match(seen.prompt ?? "", /Explain what tools the extension currently exposes/);
  assert.match(seen.prompt ?? "", /extensions\/mimir\/index.ts/);
  assert.match(seen.prompt ?? "", /https:\/\/github.com\/badlogic\/pi-mono\/blob\/main\/packages\/coding-agent\/src\/core\/extensions\/types.ts/);
  assert.equal((seen.options as { model: { id: string } }).model.id, "test-model");
  assert.equal((seen.options as { thinkingLevel: string }).thinkingLevel, "medium");
  assert.equal(result.details.role, "librarian");
  assert.match(result.details.findings, /oracle and librarian/);
  assert.deepEqual(result.details.citations, [
    "extensions/mimir/index.ts:6",
    "extensions/mimir/index.ts:12",
    "https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/extensions/types.ts",
  ]);
  assert.equal(result.details.degraded, true);
  assert.equal(result.details.sources.length, 1);
  assert.equal(result.details.passes.length, 1);
  assert.equal(result.details.researchLimitations[0], "Public search was partial beyond the hinted repo.");
  assert.equal(seen.progress.some((summary) => /hinted public repositories/i.test(summary)), true);
  assert.equal(seen.disposed, true);
});
