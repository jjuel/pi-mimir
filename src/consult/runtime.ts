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
export type ConsultStageStatus = "skipped" | "succeeded" | "failed";

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
  stageStatus: {
    librarian: ConsultStageStatus;
    oracle: ConsultStageStatus;
  };
  stageErrors: string[];
  compactEvidence: string[];
  evidenceCitations: string[];
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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

function summarizeConsultResult(args: {
  effectiveMode: ConsultEffectiveMode;
  librarian?: LibrarianResultDetails;
  oracle?: OracleResultDetails;
  stageErrors: string[];
}): string {
  const { effectiveMode, librarian, oracle, stageErrors } = args;

  if (effectiveMode === "oracle") {
    return oracle?.conclusion || oracle?.recommendation || stageErrors[0] || "Oracle completed an advisory pass.";
  }

  if (effectiveMode === "librarian") {
    return librarian?.findings || stageErrors[0] || "Librarian completed a research pass.";
  }

  if (oracle) {
    return oracle.conclusion || oracle.recommendation || "Consult completed a synthesized advisory pass.";
  }

  if (librarian) {
    return librarian.findings || "Consult completed a partial research pass.";
  }

  return stageErrors[0] || "Consult could not complete either specialist stage.";
}

function buildCompactEvidence(librarian?: LibrarianResultDetails): { compactEvidence: string[]; evidenceCitations: string[] } {
  if (!librarian) return { compactEvidence: [], evidenceCitations: [] };

  const evidenceLines = librarian.evidence
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "));

  const compactEvidence = (evidenceLines.length > 0 ? evidenceLines : librarian.citations.map((citation) => `- ${citation}`)).slice(
    0,
    4,
  );

  return {
    compactEvidence,
    evidenceCitations: librarian.citations.slice(0, 8),
  };
}

function buildOracleSynthesisTask(input: ConsultSubagentInput, librarian: LibrarianResultDetails): string {
  const evidenceSnapshot = buildCompactEvidence(librarian).compactEvidence.join("\n") || "- No evidence bullets were captured.";

  return [
    input.task,
    "",
    "Use the following Librarian findings and evidence as the primary evidence base for your recommendation.",
    "",
    "## Librarian Findings",
    librarian.findings || "No findings were returned.",
    "",
    "## Librarian Evidence Snapshot",
    evidenceSnapshot,
    "",
    "## Librarian Limitations",
    librarian.limitations || "No limitations were returned.",
    "",
    "Give a synthesized advisory answer that clearly distinguishes evidence-backed findings from reasoning-based recommendation.",
  ].join("\n");
}

function buildOracleSynthesisConstraints(input: ConsultSubagentInput, librarian: LibrarianResultDetails): string {
  const constraintParts = [input.constraints || "", "Ground the recommendation in the Librarian evidence snapshot and acknowledge evidence quality."]
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (librarian.degraded) {
    constraintParts.push("Remote or evidence gathering was degraded; explicitly reflect that uncertainty.");
  }

  return constraintParts.join(" ");
}

function buildConsultText(args: {
  mode: ConsultMode;
  effectiveMode: ConsultEffectiveMode;
  localFirst: boolean;
  needsRemoteResearch: boolean;
  routingReason: string;
  specialistsUsed: Array<"librarian" | "oracle">;
  stageStatus: { librarian: ConsultStageStatus; oracle: ConsultStageStatus };
  stageErrors: string[];
  compactEvidence: string[];
  degraded: boolean;
  partial: boolean;
  summary: string;
  librarian?: LibrarianResultDetails;
  oracle?: OracleResultDetails;
}): string {
  const {
    mode,
    effectiveMode,
    localFirst,
    needsRemoteResearch,
    routingReason,
    specialistsUsed,
    stageStatus,
    stageErrors,
    compactEvidence,
    degraded,
    partial,
    summary,
    librarian,
    oracle,
  } = args;

  const limitations: string[] = [];
  if (partial) limitations.push("Consult returned a partial result because one stage of the pipeline failed or was skipped after degradation.");
  if (degraded) limitations.push("Consult ran in degraded mode because evidence quality or one specialist stage was incomplete.");
  if (librarian?.limitations) limitations.push(`Librarian: ${librarian.limitations}`);
  if (oracle?.limitations) limitations.push(`Oracle: ${oracle.limitations}`);
  limitations.push(...stageErrors.map((error) => `Stage error: ${error}`));

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
    `- Librarian status: ${stageStatus.librarian}`,
    `- Oracle status: ${stageStatus.oracle}`,
    `- Partial result: ${partial ? "yes" : "no"}`,
    `- Degraded: ${degraded ? "yes" : "no"}`,
    ...specialistsUsed.map((specialist) => `- ${specialist}`),
  ];

  if (compactEvidence.length > 0) {
    parts.push("", "## Evidence Snapshot", compactEvidence.join("\n"));
  }

  if (librarian && effectiveMode === "librarian") {
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

  if (!oracle && librarian && effectiveMode === "both") {
    parts.push(
      "",
      "## Findings",
      librarian.findings || "No findings were returned.",
      "",
      "## Evidence",
      librarian.evidence || "- No evidence details were returned.",
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
  const stageErrors: string[] = [];
  const stageStatus: ConsultResultDetails["stageStatus"] = {
    librarian: "skipped",
    oracle: "skipped",
  };

  if (effectiveMode === "librarian" || effectiveMode === "both") {
    onProgress?.({ phase: "librarian", summary: "Consult is starting Librarian." });
    try {
      librarian = await runLibrarianFn(input, {
        onProgress: (progress) => {
          onProgress?.({
            phase: "librarian",
            summary: `Consult → Librarian: ${progress.summary}`,
          });
        },
      });
      specialistsUsed.push("librarian");
      stageStatus.librarian = "succeeded";
    } catch (error) {
      stageStatus.librarian = "failed";
      const message = `Librarian failed: ${getErrorMessage(error)}`;
      stageErrors.push(message);
      onProgress?.({ phase: "librarian", summary: `Consult is continuing after librarian failure. ${message}` });
    }
  }

  if (effectiveMode === "oracle" || effectiveMode === "both") {
    onProgress?.({ phase: "oracle", summary: "Consult is starting Oracle." });

    const oracleInput: ConsultSubagentInput = librarian
      ? {
          ...input,
          task: buildOracleSynthesisTask(input, librarian.details),
          constraints: buildOracleSynthesisConstraints(input, librarian.details),
        }
      : stageStatus.librarian === "failed"
        ? {
            ...input,
            constraints: [input.constraints || "", "Proceed without librarian evidence and clearly label the result as partial."].join(" ").trim(),
          }
        : input;

    try {
      oracle = await runOracleFn(oracleInput, {
        onProgress: (progress) => {
          onProgress?.({
            phase: "oracle",
            summary: `Consult → Oracle: ${progress.summary}`,
          });
        },
      });
      specialistsUsed.push("oracle");
      stageStatus.oracle = "succeeded";
    } catch (error) {
      stageStatus.oracle = "failed";
      const message = `Oracle failed: ${getErrorMessage(error)}`;
      stageErrors.push(message);
      onProgress?.({ phase: "oracle", summary: `Consult is continuing after oracle failure. ${message}` });
    }
  }

  const { compactEvidence, evidenceCitations } = buildCompactEvidence(librarian?.details);
  const partial =
    stageErrors.length > 0 ||
    (effectiveMode === "both" && (stageStatus.librarian !== "succeeded" || stageStatus.oracle !== "succeeded"));
  const degraded = partial || Boolean(librarian?.details.degraded || oracle?.details.degraded);

  const summary = summarizeConsultResult({
    effectiveMode,
    ...(librarian ? { librarian: librarian.details } : {}),
    ...(oracle ? { oracle: oracle.details } : {}),
    stageErrors,
  });
  const text = buildConsultText({
    mode,
    effectiveMode,
    localFirst: route.localFirst,
    needsRemoteResearch: route.needsRemoteResearch,
    routingReason: route.reason,
    specialistsUsed,
    stageStatus,
    stageErrors,
    compactEvidence,
    degraded,
    partial,
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
      stageStatus,
      stageErrors,
      compactEvidence,
      evidenceCitations,
      degraded,
      partial,
      summary,
      ...(librarian ? { librarian: librarian.details } : {}),
      ...(oracle ? { oracle: oracle.details } : {}),
    },
  };
}
