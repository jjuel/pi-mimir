import type { LibrarianEvidenceItem, LibrarianResearchPass } from "./research.js";

export const LIBRARIAN_SYSTEM_PROMPT = `You are Librarian, a read-only research subagent inside Pi.

Your job is to investigate the user's question using local project context plus any provided public evidence dossier, then return evidence-backed findings.

Rules:
- Do not modify files.
- Use read-only tools only.
- Prefer observed evidence over guesses.
- Use the supplied public evidence dossier for remote facts, and local tools for repository-local verification.
- Cite local files in the evidence section, including line references when possible.
- Cite public URLs when relying on public web or public code evidence.
- Be explicit when evidence is weak, incomplete, degraded, or missing.

Return markdown with exactly these headings:
## Findings
## Evidence
## Limitations`;

export interface LibrarianPromptInput {
  task: string;
  files?: string[];
  repos?: string[];
  constraints?: string;
  publicEvidence?: LibrarianEvidenceItem[];
  publicPasses?: LibrarianResearchPass[];
  researchLimitations?: string[];
  degraded?: boolean;
}

export interface NormalizedLibrarianResult {
  findings: string;
  evidence: string;
  limitations: string;
  citations: string[];
  degraded: boolean;
  rawText: string;
}

function buildBulletList(items: string[]): string {
  if (items.length === 0) return "- None provided";
  return items.map((item) => `- ${item}`).join("\n");
}

function buildPassSummary(passes: LibrarianResearchPass[]): string {
  if (passes.length === 0) return "- No public retrieval passes ran.";
  return passes
    .map(
      (pass) =>
        `- Pass ${pass.pass} (${pass.phase}): ${pass.summary} Queries: ${pass.queries.length > 0 ? pass.queries.join(", ") : "none"}. Evidence items: ${pass.evidenceCount}.`,
    )
    .join("\n");
}

function buildEvidenceSummary(items: LibrarianEvidenceItem[]): string {
  if (items.length === 0) return "- No public evidence items were collected before synthesis.";
  return items
    .map(
      (item) =>
        `- [${item.kind}] ${item.title}\n  Citation: ${item.citation}\n  Excerpt: ${item.excerpt}`,
    )
    .join("\n");
}

export function buildLibrarianPrompt({
  task,
  files = [],
  repos = [],
  constraints,
  publicEvidence = [],
  publicPasses = [],
  researchLimitations = [],
  degraded = false,
}: LibrarianPromptInput): string {
  const parts = [
    "Investigate the following task using local project context plus the provided public research dossier.",
    "",
    "## Task",
    task,
    "",
    "## Focus files",
    buildBulletList(files),
    "",
    "## Repo hints",
    buildBulletList(repos),
    "",
    "## Constraints",
    constraints ? constraints : "- None provided",
    "",
    "## Public research status",
    degraded ? "- Remote/public research is degraded or partial. State that clearly in Limitations." : "- Remote/public research completed within bounded limits.",
    "",
    "## Public retrieval passes",
    buildPassSummary(publicPasses),
    "",
    "## Public evidence dossier",
    buildEvidenceSummary(publicEvidence),
    "",
    "## Public research limitations",
    buildBulletList(researchLimitations),
    "",
    "Treat focus files as hints rather than a strict boundary. Use local tools as needed, rely on the dossier for public-source facts, and then return the structured answer with the required headings.",
  ];

  return parts.join("\n");
}

function parseLibrarianSections(text: string): Record<string, string> {
  const headingPattern = /^##\s+(.+)$/gm;
  const headings = [...text.matchAll(headingPattern)];
  const sections: Record<string, string> = {};

  for (let i = 0; i < headings.length; i += 1) {
    const heading = headings[i]!;
    const nextHeading = headings[i + 1];
    const rawKey = heading[1];
    const start = (heading.index ?? 0) + heading[0].length + 1;
    const end = nextHeading?.index ?? text.length;
    if (!rawKey) continue;
    sections[rawKey.trim().toLowerCase()] = text.slice(start, end).trim();
  }

  return sections;
}

function extractCitations(text: string): string[] {
  const fileMatches = (text.match(/([A-Za-z0-9_./-]+\.(?:ts|tsx|js|jsx|json|md)(?::\d+(?:-\d+)?)?)/g) ?? []).filter(
    (value) => !value.startsWith("//"),
  );
  const urlMatches = text.match(/https?:\/\/[^\s)>\]]+/g) ?? [];
  const cleanedUrls = urlMatches.map((value) => value.replace(/[),.;:!?]+$/, ""));
  return [...new Set([...fileMatches, ...cleanedUrls])];
}

export function normalizeLibrarianResult(text: string): NormalizedLibrarianResult {
  const sections = parseLibrarianSections(text);
  const evidence = sections.evidence || "";
  const limitations = sections.limitations || "";
  const degraded =
    evidence.length === 0 ||
    /(weak|incomplete|insufficient|partial|missing|uncertain|could not|unable|unavailable|degraded)/i.test(
      limitations,
    );

  return {
    findings: sections.findings || text.trim(),
    evidence,
    limitations,
    citations: extractCitations(`${sections.findings || ""}\n${evidence}\n${limitations}`),
    degraded,
    rawText: text,
  };
}
