import assert from "node:assert/strict";
import test from "node:test";

import { resolveConsultRoute } from "../src/consult/routing.js";

test("resolveConsultRoute picks oracle for local-first advisory tasks", () => {
  const decision = resolveConsultRoute({
    cwd: "/tmp/project",
    model: { id: "test-model" },
    task: "Should we keep consult orchestration in one runtime file for this extension?",
    files: ["src/consult/runtime.ts"],
    constraints: "Use the current repo only.",
  });

  assert.equal(decision.requestedMode, "automatic");
  assert.equal(decision.effectiveMode, "oracle");
  assert.equal(decision.localFirst, true);
  assert.equal(decision.needsRemoteResearch, false);
  assert.match(decision.reason, /advisory and local context appears sufficient/i);
});

test("resolveConsultRoute picks librarian for evidence-first local tasks", () => {
  const decision = resolveConsultRoute({
    cwd: "/tmp/project",
    model: { id: "test-model" },
    task: "Trace how consult is registered and cite the current code paths.",
    files: ["extensions/mimir/index.ts"],
  });

  assert.equal(decision.effectiveMode, "librarian");
  assert.equal(decision.localFirst, true);
  assert.equal(decision.needsRemoteResearch, false);
  assert.match(decision.reason, /evidence-first and local context appears sufficient/i);
});

test("resolveConsultRoute picks librarian then oracle when public research and judgment are both needed", () => {
  const decision = resolveConsultRoute({
    cwd: "/tmp/project",
    model: { id: "test-model" },
    task: "Compare this extension with public Pi docs and recommend the best default entrypoint.",
    repos: ["badlogic/pi-mono"],
  });

  assert.equal(decision.effectiveMode, "both");
  assert.equal(decision.localFirst, false);
  assert.equal(decision.needsRemoteResearch, true);
  assert.match(decision.reason, /public research plus final judgment/i);
});
