import type { ConsultEffectiveMode, ConsultMode, ConsultSubagentInput } from "./runtime.js";

export interface ConsultRouteDecision {
  requestedMode: ConsultMode;
  effectiveMode: ConsultEffectiveMode;
  localFirst: boolean;
  needsRemoteResearch: boolean;
  reason: string;
}

function normalizeText(input: ConsultSubagentInput): string {
  return [input.task, input.constraints || ""].join(" \n ").toLowerCase();
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function resolveConsultRoute(input: ConsultSubagentInput): ConsultRouteDecision {
  const requestedMode = input.mode || "automatic";
  if (requestedMode !== "automatic") {
    return {
      requestedMode,
      effectiveMode: requestedMode,
      localFirst: requestedMode !== "both" || (input.repos?.length ?? 0) === 0,
      needsRemoteResearch: requestedMode === "both" || requestedMode === "librarian"
        ? (input.repos?.length ?? 0) > 0
        : false,
      reason: `The user explicitly forced ${requestedMode} mode.`,
    };
  }

  const text = normalizeText(input);
  const hasRepoHints = (input.repos?.length ?? 0) > 0;
  const hasFileHints = (input.files?.length ?? 0) > 0;

  const wantsAdvice = hasAny(text, [
    /\bshould\b/,
    /\brecommend(?:ation)?\b/,
    /\badv(?:ice|isory)\b/,
    /\brisk(?:s)?\b/,
    /\btrade-?off(?:s)?\b/,
    /\bdecid(?:e|ing|ion)\b/,
    /\bplan(?:ning)?\b/,
    /\breview\b/,
    /\bopinion\b/,
    /\bbest\b/,
    /\bworth\b/,
  ]);

  const wantsEvidence = hasAny(text, [
    /\bfind(?:ing|ings)?\b/,
    /\bevidence\b/,
    /\bcitation(?:s)?\b/,
    /\btrace\b/,
    /\bexplain\b/,
    /\binvestigat(?:e|ion)\b/,
    /\bresearch\b/,
    /\bshow\b/,
    /\blist\b/,
    /\bcompare\b/,
    /\bwhat does\b/,
    /\bhow does\b/,
  ]);

  const mentionsRemote = hasAny(text, [
    /\bpublic\b/,
    /\bupstream\b/,
    /\bgithub\b/,
    /\bdocs?\b/,
    /\bdocumentation\b/,
    /\bweb\b/,
    /\bremote\b/,
    /\blibrar(?:y|ies)\b/,
    /\bframework\b/,
    /\bpackage\b/,
  ]);

  const localContextExplicit = hasAny(text, [
    /\blocal\b/,
    /\bcurrent project\b/,
    /\bcurrent repo\b/,
    /\bcurrent codebase\b/,
    /\bthis project\b/,
    /\bthis repo\b/,
    /\bthis codebase\b/,
    /\bthis extension\b/,
  ]) || hasFileHints;

  const needsRemoteResearch = hasRepoHints || (mentionsRemote && !localContextExplicit);

  if (needsRemoteResearch && wantsAdvice) {
    return {
      requestedMode,
      effectiveMode: "both",
      localFirst: false,
      needsRemoteResearch: true,
      reason: hasRepoHints
        ? "Automatic routing chose librarian then oracle because repo hints suggest public research plus final judgment."
        : "Automatic routing chose librarian then oracle because the task asks for public research and a recommendation.",
    };
  }

  if (needsRemoteResearch || wantsEvidence) {
    return {
      requestedMode,
      effectiveMode: "librarian",
      localFirst: !needsRemoteResearch,
      needsRemoteResearch,
      reason: needsRemoteResearch
        ? "Automatic routing chose librarian because the task is research-first and points at public or upstream sources."
        : "Automatic routing chose librarian because the task is evidence-first and local context appears sufficient.",
    };
  }

  return {
    requestedMode,
    effectiveMode: "oracle",
    localFirst: true,
    needsRemoteResearch: false,
    reason: "Automatic routing chose oracle because the task is advisory and local context appears sufficient.",
  };
}
