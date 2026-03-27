import assert from "node:assert/strict";
import test from "node:test";

import { runConsultSubagent } from "../src/consult/runtime.js";

test("runConsultSubagent automatic mode routes through librarian then oracle and returns one unified answer", async () => {
  const calls: string[] = [];
  const progress: string[] = [];

  const result = await runConsultSubagent(
    {
      cwd: "/tmp/project",
      model: { id: "test-model" },
      task: "Investigate the current extension surface and recommend the best default entrypoint.",
      files: ["extensions/mimir/index.ts"],
      repos: ["badlogic/pi-mono"],
      constraints: "Analysis only.",
      mode: "automatic",
    },
    {
      runLibrarian: async (_input, deps) => {
        calls.push("librarian");
        deps?.onProgress?.({ phase: "synthesizing", summary: "Librarian is organizing findings." });
        return {
          text: "librarian text",
          details: {
            role: "librarian",
            task: "Investigate the current extension surface",
            filesUsed: ["extensions/mimir/index.ts"],
            repoHints: ["badlogic/pi-mono"],
            constraints: "Analysis only.",
            model: "test-model",
            findings: "The extension currently registers oracle, librarian, and consult.",
            evidence:
              "- extensions/mimir/index.ts:6 registers oracle.\n- extensions/mimir/index.ts:12 registers librarian.\n- extensions/mimir/index.ts:18 registers consult.",
            limitations: "Remote evidence was not needed for this focused question.",
            citations: ["extensions/mimir/index.ts:6", "extensions/mimir/index.ts:12", "extensions/mimir/index.ts:18"],
            degraded: false,
            sources: [],
            passes: [],
            researchLimitations: [],
          },
        };
      },
      runOracle: async (_input, deps) => {
        calls.push("oracle");
        deps?.onProgress?.({ phase: "synthesizing", summary: "Oracle is synthesizing advice." });
        return {
          text: "oracle text",
          details: {
            role: "oracle",
            task: "Investigate the current extension surface",
            filesUsed: ["extensions/mimir/index.ts"],
            constraints: "Analysis only.",
            model: "test-model",
            conclusion: "Consult should be the default entrypoint when the user wants one answer.",
            reasoning: "It can hide orchestration while remaining transparent about which specialists ran.",
            risks: "Automatic routing is intentionally simple in this slice.",
            recommendation: "Use consult by default and force a mode only for debugging or steering.",
            limitations: "This slice does not yet implement richer automatic routing heuristics.",
            degraded: false,
          },
        };
      },
      onProgress(update) {
        progress.push(update.summary);
      },
    },
  );

  assert.deepEqual(calls, ["librarian", "oracle"]);
  assert.equal(result.details.mode, "automatic");
  assert.equal(result.details.effectiveMode, "both");
  assert.equal(result.details.localFirst, false);
  assert.equal(result.details.needsRemoteResearch, true);
  assert.match(result.details.routingReason, /public research/i);
  assert.deepEqual(result.details.specialistsUsed, ["librarian", "oracle"]);
  assert.equal(result.details.partial, false);
  assert.match(result.text, /## Summary/);
  assert.match(result.text, /## Specialists Used/);
  assert.match(result.text, /Requested mode: automatic/);
  assert.match(result.text, /Effective mode: both/);
  assert.match(result.text, /Local-first: no/);
  assert.match(result.text, /Remote research needed: yes/);
  assert.match(result.text, /## Findings/);
  assert.match(result.text, /## Advice/);
  assert.equal(progress.some((entry) => /Consult → Librarian/.test(entry)), true);
  assert.equal(progress.some((entry) => /Consult → Oracle/.test(entry)), true);
});

test("runConsultSubagent chooses local-first librarian for evidence-focused automatic tasks", async () => {
  let librarianCalls = 0;
  let oracleCalls = 0;

  const result = await runConsultSubagent(
    {
      cwd: "/tmp/project",
      model: { id: "test-model" },
      task: "Trace how consult is registered and cite the current code paths.",
      files: ["extensions/mimir/index.ts"],
      mode: "automatic",
    },
    {
      runLibrarian: async () => {
        librarianCalls += 1;
        return {
          text: "librarian text",
          details: {
            role: "librarian",
            task: "Trace how consult is registered and cite the current code paths.",
            filesUsed: ["extensions/mimir/index.ts"],
            repoHints: [],
            constraints: "",
            model: "test-model",
            findings: "Consult is registered in the extension entrypoint.",
            evidence: "- extensions/mimir/index.ts:1 imports the consult tool.\n- extensions/mimir/index.ts:18 registers consult.",
            limitations: "Local evidence was sufficient.",
            citations: ["extensions/mimir/index.ts:1", "extensions/mimir/index.ts:18"],
            degraded: false,
            sources: [],
            passes: [],
            researchLimitations: [],
          },
        };
      },
      runOracle: async () => {
        oracleCalls += 1;
        throw new Error("should not be called");
      },
    },
  );

  assert.equal(result.details.effectiveMode, "librarian");
  assert.equal(result.details.localFirst, true);
  assert.equal(result.details.needsRemoteResearch, false);
  assert.match(result.details.routingReason, /evidence-first/i);
  assert.deepEqual(result.details.specialistsUsed, ["librarian"]);
  assert.equal(librarianCalls, 1);
  assert.equal(oracleCalls, 0);
});

test("runConsultSubagent respects forced mode overrides", async () => {
  let librarianCalls = 0;
  let oracleCalls = 0;

  const oracleOnly = await runConsultSubagent(
    {
      cwd: "/tmp/project",
      model: { id: "test-model" },
      task: "Give advisory guidance only",
      mode: "oracle",
    },
    {
      runLibrarian: async () => {
        librarianCalls += 1;
        throw new Error("should not be called");
      },
      runOracle: async () => {
        oracleCalls += 1;
        return {
          text: "oracle text",
          details: {
            role: "oracle",
            task: "Give advisory guidance only",
            filesUsed: [],
            constraints: "",
            model: "test-model",
            conclusion: "Oracle-only route ran.",
            reasoning: "The mode explicitly forced oracle.",
            risks: "No librarian evidence was gathered.",
            recommendation: "Use librarian or both when you need explicit evidence gathering.",
            limitations: "Forced oracle mode skips librarian.",
            degraded: false,
          },
        };
      },
    },
  );

  const librarianOnly = await runConsultSubagent(
    {
      cwd: "/tmp/project",
      model: { id: "test-model" },
      task: "Gather research only",
      mode: "librarian",
    },
    {
      runLibrarian: async () => {
        librarianCalls += 1;
        return {
          text: "librarian text",
          details: {
            role: "librarian",
            task: "Gather research only",
            filesUsed: [],
            repoHints: [],
            constraints: "",
            model: "test-model",
            findings: "Librarian-only route ran.",
            evidence: "- No extra evidence was required for the test.",
            limitations: "Forced librarian mode skips oracle.",
            citations: [],
            degraded: false,
            sources: [],
            passes: [],
            researchLimitations: [],
          },
        };
      },
      runOracle: async () => {
        oracleCalls += 1;
        throw new Error("should not be called");
      },
    },
  );

  assert.equal(oracleOnly.details.effectiveMode, "oracle");
  assert.deepEqual(oracleOnly.details.specialistsUsed, ["oracle"]);
  assert.match(oracleOnly.text, /Oracle-only route ran/);

  assert.equal(librarianOnly.details.effectiveMode, "librarian");
  assert.deepEqual(librarianOnly.details.specialistsUsed, ["librarian"]);
  assert.match(librarianOnly.text, /Librarian-only route ran/);

  assert.equal(librarianCalls, 1);
  assert.equal(oracleCalls, 1);
});
