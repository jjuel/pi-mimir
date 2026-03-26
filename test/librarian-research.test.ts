import assert from "node:assert/strict";
import test from "node:test";

import { runLibrarianResearch } from "../src/librarian/research.js";

test("runLibrarianResearch performs bounded multi-pass public code and web retrieval with soft repo hints", async () => {
  const seen = {
    repoFiles: [] as string[],
    searchQueries: [] as string[],
    webPages: [] as string[],
  };

  const result = await runLibrarianResearch(
    {
      task: "Compare how TanStack Query recommends query invalidation",
      repos: ["tanstack/query", "https://github.com/reduxjs/redux-toolkit"],
      constraints: "Prefer official sources.",
    },
    {
      budget: {
        maxRepoHints: 1,
        maxCodeFilesPerRepo: 1,
        maxDocsPages: 1,
        maxWebQueries: 2,
        maxResultsPerQuery: 2,
        maxWebPages: 1,
        maxEvidence: 5,
      },
      adapter: {
        async fetchRepoFile(repo, path) {
          seen.repoFiles.push(`${repo}:${path}`);
          if (repo !== "tanstack/query") return null;
          if (path === "README.md") {
            return {
              title: "tanstack/query README",
              url: "https://github.com/tanstack/query/blob/main/README.md",
              content: "TanStack Query README covering invalidation guidance.",
            };
          }
          if (path === "package.json") {
            return {
              title: "tanstack/query package.json",
              url: "https://github.com/tanstack/query/blob/main/package.json",
              content: JSON.stringify({ homepage: "https://tanstack.com/query/latest", module: "src/index.ts" }),
            };
          }
          if (path === "src/index.ts") {
            return {
              title: "tanstack/query src/index.ts",
              url: "https://github.com/tanstack/query/blob/main/src/index.ts",
              content: "export * from './core';",
            };
          }
          return null;
        },
        async searchWeb(query) {
          seen.searchQueries.push(query);
          return [
            {
              title: "Query invalidation guide",
              url: "https://example.com/query-invalidation",
              snippet: "Official query invalidation guide.",
            },
          ];
        },
        async fetchWebPage(url) {
          seen.webPages.push(url);
          if (url === "https://tanstack.com/query/latest") {
            return {
              title: "TanStack Query docs",
              url,
              content: "The docs describe targeted invalidation after mutations.",
            };
          }
          if (url === "https://example.com/query-invalidation") {
            return {
              title: "Query invalidation guide",
              url,
              content: "Use invalidateQueries for related stale data after writes.",
            };
          }
          return null;
        },
      },
    },
  );

  assert.deepEqual(result.repoHintsUsed, ["tanstack/query"]);
  assert.equal(result.passes.length, 3);
  assert.deepEqual(
    result.passes.map((pass) => pass.phase),
    ["repo-hints", "repo-docs", "web-search"],
  );
  assert.equal(result.evidence.length, 5);
  assert.equal(result.evidence.some((item) => item.kind === "public-code"), true);
  assert.equal(result.evidence.some((item) => item.kind === "public-web"), true);
  assert.equal(seen.searchQueries[0], "Compare how TanStack Query recommends query invalidation");
  assert.match(result.webQueries[1] ?? "", /tanstack\/query/);
  assert.deepEqual(seen.webPages, ["https://tanstack.com/query/latest", "https://example.com/query-invalidation"]);
  assert.equal(result.degraded, false);
});

test("runLibrarianResearch labels degraded fallback when remote retrieval is unavailable", async () => {
  const result = await runLibrarianResearch(
    {
      task: "Inspect public guidance for cache invalidation",
      repos: ["tanstack/query"],
    },
    {
      adapter: {
        async fetchRepoFile() {
          throw new Error("network down");
        },
        async searchWeb() {
          throw new Error("search unavailable");
        },
        async fetchWebPage() {
          throw new Error("fetch unavailable");
        },
      },
    },
  );

  assert.equal(result.evidence.length, 0);
  assert.equal(result.degraded, true);
  assert.equal(result.limitations.some((value) => /network down/i.test(value)), true);
  assert.equal(result.limitations.some((value) => /No remote public evidence/i.test(value)), true);
});
