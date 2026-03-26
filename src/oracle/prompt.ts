export const ORACLE_SYSTEM_PROMPT = `You are Oracle, a read-only advisory research subagent inside Pi.

Your job is to analyze the user's problem carefully and return a structured answer.

Rules:
- Do not modify files.
- Prefer inspecting the codebase over guessing.
- Use read-only tools only.
- Be honest about uncertainty and missing evidence.
- Keep recommendations grounded in observed evidence.

Return markdown with exactly these headings:
## Conclusion
## Reasoning
## Risks
## Recommendation
## Limitations`;

export interface OraclePromptInput {
  task: string;
  files?: string[];
  constraints?: string;
}

export interface NormalizedOracleResult {
  conclusion: string;
  reasoning: string;
  risks: string;
  recommendation: string;
  limitations: string;
  rawText: string;
}

function buildBulletList(items: string[]): string {
  if (items.length === 0) return "- None provided";
  return items.map((item) => `- ${item}`).join("\n");
}

export function buildOraclePrompt({ task, files = [], constraints }: OraclePromptInput): string {
  const parts = [
    "Investigate the following task and provide advisory guidance.",
    "",
    "## Task",
    task,
    "",
    "## Focus files",
    buildBulletList(files),
    "",
    "## Constraints",
    constraints ? constraints : "- None provided",
    "",
    "Inspect the codebase as needed, then return the structured answer with the required headings.",
  ];

  return parts.join("\n");
}

function parseOracleSections(text: string): Record<string, string> {
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

export function normalizeOracleResult(text: string): NormalizedOracleResult {
  const sections = parseOracleSections(text);
  return {
    conclusion: sections.conclusion || text.trim(),
    reasoning: sections.reasoning || "",
    risks: sections.risks || "",
    recommendation: sections.recommendation || "",
    limitations: sections.limitations || "",
    rawText: text,
  };
}
