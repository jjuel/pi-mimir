export const LIBRARIAN_SYSTEM_PROMPT = `You are Librarian, a read-only research subagent inside Pi.

Your job is to investigate the user's question using local project context only and return evidence-backed findings.

Rules:
- Do not modify files.
- Use read-only tools only.
- Prefer observed evidence over guesses.
- Cite local files in the evidence section, including line references when possible.
- Be explicit when evidence is weak, incomplete, or missing.
- Do not use remote sources in this v1 slice, even if repo hints are provided.

Return markdown with exactly these headings:
## Findings
## Evidence
## Limitations`;

export interface LibrarianPromptInput {
  task: string;
  files?: string[];
  repos?: string[];
  constraints?: string;
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

export function buildLibrarianPrompt({
  task,
  files = [],
  repos = [],
  constraints,
}: LibrarianPromptInput): string {
  const parts = [
    "Investigate the following task using local project context only.",
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
    "Treat focus files as hints rather than a strict boundary. Gather evidence from the local codebase as needed, then return the structured answer with the required headings.",
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
  const matches = text.match(/([A-Za-z0-9_./-]+\.(?:ts|tsx|js|jsx|json|md)(?::\d+(?:-\d+)?)?)/g) ?? [];
  return [...new Set(matches)];
}

export function normalizeLibrarianResult(text: string): NormalizedLibrarianResult {
  const sections = parseLibrarianSections(text);
  const evidence = sections.evidence || "";
  const limitations = sections.limitations || "";
  const degraded =
    evidence.length === 0 ||
    /(weak|incomplete|insufficient|partial|missing|uncertain|could not|unable|unavailable)/i.test(limitations);

  return {
    findings: sections.findings || text.trim(),
    evidence,
    limitations,
    citations: extractCitations(`${sections.findings || ""}\n${evidence}\n${limitations}`),
    degraded,
    rawText: text,
  };
}
