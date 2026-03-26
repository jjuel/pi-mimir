import assert from "node:assert/strict";
import test from "node:test";

import mimirExtension from "../extensions/mimir/index.js";

test("mimir extension registers the oracle tool with the expected public contract", () => {
  let registeredTool: {
    name: string;
    label: string;
    description: string;
    parameters: { properties?: Record<string, unknown>; required?: string[] };
    promptGuidelines?: string[];
  } | undefined;

  mimirExtension({
    registerTool(tool: unknown) {
      registeredTool = tool as {
        name: string;
        label: string;
        description: string;
        parameters: { properties?: Record<string, unknown>; required?: string[] };
        promptGuidelines?: string[];
      };
    },
    getThinkingLevel() {
      return "high";
    },
  } as never);

  assert.ok(registeredTool);
  assert.equal(registeredTool.name, "oracle");
  assert.equal(registeredTool.label, "Oracle");
  assert.match(registeredTool.description, /Read-only advisory subagent/);
  assert.deepEqual(registeredTool.parameters.required, ["task"]);
  assert.deepEqual(Object.keys(registeredTool.parameters.properties ?? {}), ["task", "files", "constraints"]);
  assert.equal(registeredTool.promptGuidelines?.length, 2);
});
