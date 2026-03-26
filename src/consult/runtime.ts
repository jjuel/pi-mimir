import {
  runLibrarianSubagent,
  type LibrarianProgress,
  type LibrarianResultDetails,
  type LibrarianSubagentResult,
} from "../librarian/runtime.js";
import {
  runOracleSubagent,
  type OracleProgress,
  type OracleResultDetails,
  type OracleSubagentResult,
} from "../oracle/runtime.js";
import { resolveConsultRoute } from "./routing.js";

export type ConsultMode = "automatic" | "oracle" | "librarian" | "both";
export type ConsultEffectiveMode = "oracle" | "librarian" | "both";
export type ConsultPhase = "starting" | "routing" | "librarian" | "oracle" | "finalizing";

export interface ConsultProgress {
  phase: ConsultPhase;
  summary: string;
}

export interface ConsultResultDetails {
  role: "consult";
  task: string;
  mode: ConsultMode;
  effectiveMode: ConsultEffectiveMode;
  localFirst: boolean;
  needsRemoteResearch: boolean;
  routingReason: string;
  filesUsed: string[];
  repoHints: string[];
  constraints: string;
  model: string;
  specialistsUsed: Array<"librarian" | "oracle">;
  degraded: boolean;
  partial: boolean;
  summary: string;
  librarian?: LibrarianResultDetails;
  oracle?: OracleResultDetails;
}

export interface ConsultSubagentResult {
  text: string;
  details: ConsultResultDetails;
}

export interface ConsultSubagentInput {
  cwd: string;
  model: { id: string };
  thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
  authStorage?: unknown;
  modelRegistry?: unknown;
  task: string;
  files?: string[];
  repos?: string[];
  constraints?: string;
  mode?: ConsultMode;
}

export interface ConsultSubagentDeps {
  runLibrarian?: (
    input: ConsultSubagentInput,
    deps?: { onProgress?: (progress: LibrarianProgress) => void },
  ) => Promise<LibrarianSubagentResult>;
  runOracle?: (
    input: ConsultSubagentInput,
    deps?: { onProgress?: (progress: OracleProgress) => void },
  ) => Promise<OracleSubagentResult>;
  onProgress?: (progress: ConsultProgress) => void;
}

function bulletList(items: string[]): string {
  return items.length === 0 ? "- None reported" : items.map((item) => `- ${item}`).join("\n");
}

function summarizeConsultResult(args: {
  effectiveMode: ConsultEffectiveMode;
  librarian?: LibrarianResultDetails;
  oracle?: OracleResultDetails;
}): string {
  const { effectiveMode, librarian, oracle } = args;

  if (effectiveMode === "oracle") {
    return oracle?.conclusion || oracle?.recommendation || "Oracle completed an advisory pass.";
  }

  if (effectiveMode === "librarian") {
    return librarian?.findings || "Librarian completed a research pass.";
  }

  const librarianSummary = librarian?.findings || "Librarian completed a research pass.";
  const oracleSummary = oracle?.conclusion || oracle?.recommendation || "Oracle completed an advisory pass.";
  return `${librarianSummary}\n\n${oracleSummary}`;
}

function buildConsultText(args: {
  mode: ConsultMode;
  effectiveMode: ConsultEffectiveMode;
  localFirst: boolean;
  needsRemoteResearch: boolean;
  routingReason: string;
  specialistsUsed: Array<"librarian" | "oracle">;
  summary: string;
  librarian?: LibrarianResultDetails;
  oracle?: OracleResultDetails;
}): string {
  const { mode, effectiveMode, localFirst, needsRemoteResearch, routingReason, specialistsUsed, summary, librarian, oracle } =
    args;
  const limitations: string[] = [];
  if (librarian?.limitations) limitations.push(`Librarian: ${librarian.limitations}`);
  if (oracle?.limitations) limitations.push(`Oracle: ${oracle.limitations}`);

  const parts = [
    "## Summary",
    summary,
    "",
    "## Specialists Used",
    `- Requested mode: ${mode}`,
    `- Effective mode: ${effectiveMode}`,
    `- Local-first: ${localFirst ? "yes" : "no"}`,
    `- Remote research needed: ${needsRemoteResearch ? "yes" : "no"}`,
    `- Routing reason: ${routingReason}`,
    ...specialistsUsed.map((specialist) => `- ${specialist}`),
  ];

  if (librarian) {
    parts.push(
      "",
      "## Findings",
      librarian.findings || "No findings were returned.",
      "",
      "## Evidence",
      librarian.evidence || "- No evidence details were returned.",
    );
  }

  if (oracle) {
    parts.push(
      "",
      "## Advice",
      `**Conclusion:** ${oracle.conclusion || "No conclusion returned."}`,
      "",
      `**Reasoning:** ${oracle.reasoning || "No reasoning returned."}`,
      "",
      `**Risks:** ${oracle.risks || "No risks returned."}`,
      "",
      `**Recommendation:** ${oracle.recommendation || "No recommendation returned."}`,
    );
  }

  parts.push("", "## Limitations", bulletList(limitations));
  return parts.join("\n");
}

export async function runConsultSubagent(
  input: ConsultSubagentInput,
  deps: ConsultSubagentDeps = {},
): Promise<ConsultSubagentResult> {
  const { onProgress } = deps;
  const runLibrarianFn = (deps.runLibrarian ?? (runLibrarianSubagent as ConsultSubagentDeps["runLibrarian"]))!;
  const runOracleFn = (deps.runOracle ?? (runOracleSubagent as ConsultSubagentDeps["runOracle"]))!;

  const route = resolveConsultRoute(input);
  const mode = route.requestedMode;
  const effectiveMode = route.effectiveMode;

  onProgress?.({ phase: "starting", summary: "Consult is preparing its orchestration pass." });
  onProgress?.({ phase: "routing", summary: `Consult selected the ${effectiveMode} route. ${route.reason}` });

  let librarian: LibrarianSubagentResult | undefined;
  let oracle: OracleSubagentResult | undefined;
  const specialistsUsed: Array<"librarian" | "oracle"> = [];

  if (effectiveMode === "librarian" || effectiveMode === "both") {
    onProgress?.({ phase: "librarian", summary: "Consult is starting Librarian." });
    librarian = await runLibrarianFn(input, {
      onProgress: (progress) => {
        onProgress?.({
          phase: "librarian",
          summary: `Consult → Librarian: ${progress.summary}`,
        });
      },
    });
    specialistsUsed.push("librarian");
  }

  if (effectiveMode === "oracle" || effectiveMode === "both") {
    onProgress?.({ phase: "oracle", summary: "Consult is starting Oracle." });
    oracle = await runOracleFn(input, {
      onProgress: (progress) => {
        onProgress?.({
          phase: "oracle",
          summary: `Consult → Oracle: ${progress.summary}`,
        });
      },
    });
    specialistsUsed.push("oracle");
  }

  const summary = summarizeConsultResult({
    effectiveMode,
    ...(librarian ? { librarian: librarian.details } : {}),
    ...(oracle ? { oracle: oracle.details } : {}),
  });
  const text = buildConsultText({
    mode,
    effectiveMode,
    localFirst: route.localFirst,
    needsRemoteResearch: route.needsRemoteResearch,
    routingReason: route.reason,
    specialistsUsed,
    summary,
    ...(librarian ? { librarian: librarian.details } : {}),
    ...(oracle ? { oracle: oracle.details } : {}),
  });

  onProgress?.({ phase: "finalizing", summary: "Consult is assembling the unified answer." });

  return {
    text,
    details: {
      role: "consult",
      task: input.task,
      mode,
      effectiveMode,
      localFirst: route.localFirst,
      needsRemoteResearch: route.needsRemoteResearch,
      routingReason: route.reason,
      filesUsed: input.files || [],
      repoHints: input.repos || [],
      constraints: input.constraints || "",
      model: input.model.id,
      specialistsUsed,
      degraded: Boolean(librarian?.details.degraded || oracle?.details.degraded),
      partial: false,
      summary,
      ...(librarian ? { librarian: librarian.details } : {}),
      ...(oracle ? { oracle: oracle.details } : {}),
    },
  };
}
