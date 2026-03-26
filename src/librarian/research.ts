interface WebSearchResult {
  title: string;
  url: string;
  snippet?: string;
}

export interface RetrievedDocument {
  title: string;
  url: string;
  content: string;
}

export interface LibrarianResearchAdapter {
  fetchRepoFile(repo: string, path: string): Promise<RetrievedDocument | null>;
  searchWeb(query: string, options: { limit: number }): Promise<WebSearchResult[]>;
  fetchWebPage(url: string): Promise<RetrievedDocument | null>;
}

export type LibrarianEvidenceKind = "public-code" | "public-web";

export interface LibrarianEvidenceItem {
  kind: LibrarianEvidenceKind;
  title: string;
  location: string;
  citation: string;
  excerpt: string;
  pass: number;
}

export interface LibrarianResearchPass {
  pass: number;
  phase: "repo-hints" | "repo-docs" | "web-search";
  summary: string;
  queries: string[];
  evidenceCount: number;
}

export interface LibrarianResearchBudget {
  maxPasses: number;
  maxRepoHints: number;
  maxCodeFilesPerRepo: number;
  maxDocsPages: number;
  maxWebQueries: number;
  maxResultsPerQuery: number;
  maxWebPages: number;
  maxEvidence: number;
}

export interface LibrarianResearchInput {
  task: string;
  repos?: string[];
  constraints?: string;
}

export interface LibrarianResearchProgress {
  phase: "repo-hints" | "repo-docs" | "web-search";
  summary: string;
}

export interface LibrarianResearchResult {
  evidence: LibrarianEvidenceItem[];
  passes: LibrarianResearchPass[];
  limitations: string[];
  degraded: boolean;
  repoHintsUsed: string[];
  webQueries: string[];
  budget: LibrarianResearchBudget;
}

export interface LibrarianResearchDeps {
  adapter?: LibrarianResearchAdapter;
  budget?: Partial<LibrarianResearchBudget>;
  onProgress?: (progress: LibrarianResearchProgress) => void;
}

const DEFAULT_BUDGET: LibrarianResearchBudget = {
  maxPasses: 3,
  maxRepoHints: 2,
  maxCodeFilesPerRepo: 2,
  maxDocsPages: 2,
  maxWebQueries: 2,
  maxResultsPerQuery: 3,
  maxWebPages: 2,
  maxEvidence: 8,
};

const README_PATHS = ["README.md", "readme.md"];
const COMMON_CODE_PATHS = [
  "src/index.ts",
  "src/index.tsx",
  "src/main.ts",
  "index.ts",
  "index.js",
  "lib/index.js",
  "dist/index.js",
];

function mergeBudget(overrides: Partial<LibrarianResearchBudget> = {}): LibrarianResearchBudget {
  return { ...DEFAULT_BUDGET, ...overrides };
}

function trimTrailingPunctuation(value: string): string {
  return value.replace(/[),.;:!?]+$/, "");
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function toExcerpt(value: string, maxLength = 320): string {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function normalizeRepoHint(value: string): string | null {
  const trimmed = value.trim().replace(/\.git$/, "");
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(trimmed)) return trimmed;

  const match = trimmed.match(/github\.com[/:]([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/i);
  return match?.[1] ?? null;
}

function safeJsonParse(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function collectExportPaths(value: unknown, paths: string[]): void {
  if (typeof value === "string") {
    paths.push(value);
    return;
  }

  if (!value || typeof value !== "object") return;
  for (const nested of Object.values(value as Record<string, unknown>)) {
    collectExportPaths(nested, paths);
  }
}

function normalizeCandidatePath(value: string): string | null {
  const trimmed = value.trim().replace(/^\.\//, "").replace(/^\//, "");
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return null;
  if (!/\.(?:ts|tsx|js|jsx|mjs|cjs|json|md)$/i.test(trimmed)) return null;
  return trimmed;
}

function collectPackageMetadata(packageJsonText: string): {
  codePaths: string[];
  docsUrls: string[];
} {
  const packageJson = safeJsonParse(packageJsonText);
  if (!packageJson) return { codePaths: [], docsUrls: [] };

  const codeCandidates: string[] = [];
  const docsUrls: string[] = [];

  for (const key of ["main", "module", "types", "typings", "browser", "source"]) {
    const value = packageJson[key];
    if (typeof value === "string") codeCandidates.push(value);
  }

  collectExportPaths(packageJson.exports, codeCandidates);

  for (const key of ["homepage", "docs", "documentation"]) {
    const value = packageJson[key];
    if (typeof value === "string" && /^https?:\/\//i.test(value)) docsUrls.push(value);
  }

  return {
    codePaths: unique(codeCandidates.map(normalizeCandidatePath).filter((value): value is string => !!value)),
    docsUrls: unique(docsUrls),
  };
}

function createEvidenceItem(
  kind: LibrarianEvidenceKind,
  pass: number,
  document: RetrievedDocument,
): LibrarianEvidenceItem {
  const citation = trimTrailingPunctuation(document.url);
  return {
    kind,
    title: document.title,
    location: document.url,
    citation,
    excerpt: toExcerpt(document.content),
    pass,
  };
}

function shouldStop(evidence: LibrarianEvidenceItem[], budget: LibrarianResearchBudget): boolean {
  return evidence.length >= budget.maxEvidence;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(html: string): string {
  return normalizeWhitespace(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

function extractTitle(html: string): string {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return title ? decodeHtml(normalizeWhitespace(title)) : "Untitled page";
}

function parseDuckDuckGoResults(html: string): WebSearchResult[] {
  const results: WebSearchResult[] = [];
  const pattern = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(pattern)) {
    const rawHref = match[1];
    const rawTitle = match[2];
    if (!rawHref || !rawTitle) continue;

    let url = decodeHtml(rawHref);
    if (url.startsWith("//duckduckgo.com/l/?")) url = `https:${url}`;
    if (url.includes("duckduckgo.com/l/?")) {
      try {
        const parsed = new URL(url);
        const uddg = parsed.searchParams.get("uddg");
        if (uddg) url = decodeURIComponent(uddg);
      } catch {
        continue;
      }
    }

    if (!/^https?:\/\//i.test(url)) continue;
    results.push({
      title: stripHtml(rawTitle),
      url,
    });
  }

  return uniqueByUrl(results);
}

function uniqueByUrl<T extends { url: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];
  for (const item of items) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    deduped.push(item);
  }
  return deduped;
}

async function fetchText(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      "user-agent": "pi-mimir/0.1 (+https://github.com/jjuel/pi-mimir)",
      accept: "text/html, text/plain, application/json;q=0.9, */*;q=0.8",
      ...(init.headers ?? {}),
    },
    signal: init.signal ?? AbortSignal.timeout(10_000),
  });
}

export function createDefaultLibrarianResearchAdapter(): LibrarianResearchAdapter {
  const branchCache = new Map<string, string[]>();

  async function getBranchCandidates(repo: string): Promise<string[]> {
    const cached = branchCache.get(repo);
    if (cached) return cached;

    const candidates = ["main", "master"];
    try {
      const response = await fetchText(`https://api.github.com/repos/${repo}`, {
        headers: { accept: "application/vnd.github+json" },
      });
      if (response.ok) {
        const json = (await response.json()) as { default_branch?: string };
        if (json.default_branch) candidates.unshift(json.default_branch);
      }
    } catch {
      // Fall back to common branches.
    }

    const uniqueCandidates = unique(candidates);
    branchCache.set(repo, uniqueCandidates);
    return uniqueCandidates;
  }

  return {
    async fetchRepoFile(repo, path) {
      const branches = await getBranchCandidates(repo);
      for (const branch of branches) {
        const rawUrl = `https://raw.githubusercontent.com/${repo}/${branch}/${path}`;
        const response = await fetchText(rawUrl, {
          headers: { accept: "text/plain, application/json;q=0.9, */*;q=0.8" },
        });
        if (!response.ok) {
          if (response.status === 404) continue;
          return null;
        }

        const content = await response.text();
        return {
          title: `${repo}/${path}`,
          url: `https://github.com/${repo}/blob/${branch}/${path}`,
          content,
        };
      }
      return null;
    },

    async searchWeb(query, options) {
      const response = await fetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
      if (!response.ok) return [];
      const html = await response.text();
      return parseDuckDuckGoResults(html).slice(0, options.limit);
    },

    async fetchWebPage(url) {
      const response = await fetchText(url);
      if (!response.ok) return null;
      const contentType = response.headers.get("content-type") || "";
      const text = await response.text();
      if (/html/i.test(contentType)) {
        return {
          title: extractTitle(text),
          url,
          content: stripHtml(text),
        };
      }

      return {
        title: url,
        url,
        content: text,
      };
    },
  };
}

function buildWebQueries(task: string, repoHints: string[], budget: LibrarianResearchBudget): string[] {
  const queryCandidates = [
    task,
    repoHints.length > 0 ? `${task} ${repoHints.join(" ")}` : null,
  ].filter((value): value is string => !!value && value.trim().length > 0);

  return unique(queryCandidates).slice(0, budget.maxWebQueries);
}

async function fetchFirstRepoFile(
  adapter: LibrarianResearchAdapter,
  repo: string,
  paths: string[],
): Promise<RetrievedDocument | null> {
  for (const path of paths) {
    const document = await adapter.fetchRepoFile(repo, path);
    if (document) return document;
  }
  return null;
}

export async function runLibrarianResearch(
  input: LibrarianResearchInput,
  deps: LibrarianResearchDeps = {},
): Promise<LibrarianResearchResult> {
  const budget = mergeBudget(deps.budget);
  const adapter = deps.adapter ?? createDefaultLibrarianResearchAdapter();
  const evidence: LibrarianEvidenceItem[] = [];
  const passes: LibrarianResearchPass[] = [];
  const limitations: string[] = [];
  const docsUrls = new Set<string>();

  const repoHintsUsed = unique((input.repos ?? []).map(normalizeRepoHint).filter((value): value is string => !!value)).slice(
    0,
    budget.maxRepoHints,
  );

  if (repoHintsUsed.length > 0 && budget.maxPasses >= 1) {
    deps.onProgress?.({ phase: "repo-hints", summary: "Librarian is inspecting hinted public repositories." });
    const passNumber = passes.length + 1;
    const beforeCount = evidence.length;

    for (const repo of repoHintsUsed) {
      if (shouldStop(evidence, budget)) break;

      try {
        const readme = await fetchFirstRepoFile(adapter, repo, README_PATHS);
        if (readme && !shouldStop(evidence, budget)) {
          evidence.push(createEvidenceItem("public-code", passNumber, readme));
        }

        const packageJson = await adapter.fetchRepoFile(repo, "package.json");
        let packageMetadata: { codePaths: string[]; docsUrls: string[] } = { codePaths: [], docsUrls: [] };
        if (packageJson && !shouldStop(evidence, budget)) {
          evidence.push(createEvidenceItem("public-code", passNumber, packageJson));
          packageMetadata = collectPackageMetadata(packageJson.content);
          for (const url of packageMetadata.docsUrls) docsUrls.add(url);
        }

        for (const path of unique([...packageMetadata.codePaths, ...COMMON_CODE_PATHS]).slice(0, budget.maxCodeFilesPerRepo)) {
          if (shouldStop(evidence, budget)) break;
          const codeDocument = await adapter.fetchRepoFile(repo, path);
          if (codeDocument) evidence.push(createEvidenceItem("public-code", passNumber, codeDocument));
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        limitations.push(`Public code retrieval was partially unavailable for ${repo}: ${reason}`);
      }
    }

    passes.push({
      pass: passNumber,
      phase: "repo-hints",
      summary: `Inspected ${repoHintsUsed.length} hinted public repos.`,
      queries: repoHintsUsed,
      evidenceCount: evidence.length - beforeCount,
    });
  }

  if (docsUrls.size > 0 && passes.length < budget.maxPasses && !shouldStop(evidence, budget)) {
    deps.onProgress?.({ phase: "repo-docs", summary: "Librarian is fetching public documentation pages." });
    const passNumber = passes.length + 1;
    const beforeCount = evidence.length;

    for (const url of [...docsUrls].slice(0, budget.maxDocsPages)) {
      if (shouldStop(evidence, budget)) break;
      try {
        const page = await adapter.fetchWebPage(url);
        if (page) evidence.push(createEvidenceItem("public-web", passNumber, page));
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        limitations.push(`Public documentation retrieval was unavailable for ${url}: ${reason}`);
      }
    }

    passes.push({
      pass: passNumber,
      phase: "repo-docs",
      summary: `Fetched up to ${budget.maxDocsPages} public documentation pages.`,
      queries: [...docsUrls].slice(0, budget.maxDocsPages),
      evidenceCount: evidence.length - beforeCount,
    });
  }

  let fetchedWebPages = 0;
  const webQueries = buildWebQueries(input.task, repoHintsUsed, budget);
  if (webQueries.length > 0 && passes.length < budget.maxPasses && !shouldStop(evidence, budget)) {
    deps.onProgress?.({ phase: "web-search", summary: "Librarian is widening to public web sources." });
    const passNumber = passes.length + 1;
    const beforeCount = evidence.length;

    for (const query of webQueries) {
      if (shouldStop(evidence, budget) || fetchedWebPages >= budget.maxWebPages) break;

      try {
        const results = await adapter.searchWeb(query, { limit: budget.maxResultsPerQuery });
        for (const result of results) {
          if (shouldStop(evidence, budget) || fetchedWebPages >= budget.maxWebPages) break;
          try {
            const page = await adapter.fetchWebPage(result.url);
            if (!page) continue;
            evidence.push(
              createEvidenceItem("public-web", passNumber, {
                title: page.title || result.title,
                url: page.url,
                content: page.content || result.snippet || result.title,
              }),
            );
            fetchedWebPages += 1;
          } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            limitations.push(`Public web page retrieval was unavailable for ${result.url}: ${reason}`);
          }
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        limitations.push(`Public web search was unavailable for query "${query}": ${reason}`);
      }
    }

    passes.push({
      pass: passNumber,
      phase: "web-search",
      summary: `Ran up to ${webQueries.length} public web queries within bounded limits.`,
      queries: webQueries,
      evidenceCount: evidence.length - beforeCount,
    });
  }

  if (repoHintsUsed.length === 0) {
    limitations.push("No repository hints were provided, so public code retrieval started from general web widening instead.");
  }
  if (evidence.length === 0) {
    limitations.push("No remote public evidence was gathered, so Librarian must rely on local project context only.");
  }

  return {
    evidence,
    passes,
    limitations: unique(limitations),
    degraded: evidence.length === 0 || limitations.some((value) => /(unavailable|partial|no remote public evidence)/i.test(value)),
    repoHintsUsed,
    webQueries,
    budget,
  };
}
