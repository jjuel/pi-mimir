import assert from "node:assert/strict";
import test from "node:test";

import mimirExtension from "../extensions/mimir/index.js";

test("mimir extension registers oracle, librarian, and consult with the expected public contracts", () => {
  const registeredTools = new Map<
    string,
    {
      name: string;
      label: string;
      description: string;
      parameters: { properties?: Record<string, unknown>; required?: string[] };
      promptGuidelines?: string[];
    }
  >();

  mimirExtension({
    registerTool(tool: unknown) {
      const typedTool = tool as {
        name: string;
        label: string;
        description: string;
        parameters: { properties?: Record<string, unknown>; required?: string[] };
        promptGuidelines?: string[];
      };
      registeredTools.set(typedTool.name, typedTool);
    },
    getThinkingLevel() {
      return "high";
    },
  } as never);

  const oracle = registeredTools.get("oracle");
  const librarian = registeredTools.get("librarian");
  const consult = registeredTools.get("consult");

  assert.ok(oracle);
  assert.equal(oracle.name, "oracle");
  assert.equal(oracle.label, "Oracle");
  assert.match(oracle.description, /Read-only advisory subagent/);
  assert.deepEqual(oracle.parameters.required, ["task"]);
  assert.deepEqual(Object.keys(oracle.parameters.properties ?? {}), ["task", "files", "constraints"]);
  assert.equal(oracle.promptGuidelines?.length, 2);

  assert.ok(librarian);
  assert.equal(librarian.name, "librarian");
  assert.equal(librarian.label, "Librarian");
  assert.match(librarian.description, /Read-only research subagent/);
  assert.deepEqual(librarian.parameters.required, ["task"]);
  assert.deepEqual(Object.keys(librarian.parameters.properties ?? {}), ["task", "files", "repos", "constraints"]);
  assert.equal(librarian.promptGuidelines?.length, 2);

  assert.ok(consult);
  assert.equal(consult.name, "consult");
  assert.equal(consult.label, "Consult");
  assert.match(consult.description, /Unified non-mutating research entrypoint/);
  assert.deepEqual(consult.parameters.required, ["task"]);
  assert.deepEqual(Object.keys(consult.parameters.properties ?? {}), ["task", "files", "repos", "constraints", "mode"]);
  assert.equal(consult.promptGuidelines?.length, 2);
});
