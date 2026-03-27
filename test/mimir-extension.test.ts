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
  const registeredCommands = new Map<
    string,
    {
      description?: string;
      handler: (args: string, ctx: unknown) => Promise<void>;
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
    registerCommand(name: string, command: unknown) {
      registeredCommands.set(name, command as { description?: string; handler: (args: string, ctx: unknown) => Promise<void> });
    },
    sendMessage() {},
    getThinkingLevel() {
      return "high";
    },
  } as never);

  const oracle = registeredTools.get("oracle");
  const librarian = registeredTools.get("librarian");
  const consult = registeredTools.get("consult");
  const oracleCommand = registeredCommands.get("oracle");
  const librarianCommand = registeredCommands.get("librarian");
  const consultCommand = registeredCommands.get("consult");

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

  assert.ok(oracleCommand);
  assert.match(oracleCommand.description || "", /Run Oracle directly as a slash command/i);

  assert.ok(librarianCommand);
  assert.match(librarianCommand.description || "", /Run Librarian directly as a slash command/i);

  assert.ok(consultCommand);
  assert.match(consultCommand.description || "", /Run Consult directly as a slash command/i);
});
