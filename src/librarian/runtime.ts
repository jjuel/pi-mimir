import {
  DefaultResourceLoader,
  SessionManager,
  SettingsManager,
  createAgentSession,
  createReadOnlyTools,
} from "@mariozechner/pi-coding-agent";

import {
  LIBRARIAN_SYSTEM_PROMPT,
  buildLibrarianPrompt,
  normalizeLibrarianResult,
} from "./prompt.js";
import {
  runLibrarianResearch,
  type LibrarianEvidenceItem,
  type LibrarianResearchPass,
  type LibrarianResearchProgress,
  type LibrarianResearchResult,
} from "./research.js";

type CreateSession = typeof createAgentSession;
type CreateSessionOptions = NonNullable<Parameters<CreateSession>[0]>;
type CreateSessionResult = Awaited<ReturnType<CreateSession>>;
type AgentSession = CreateSessionResult["session"];
type ResourceLoader = NonNullable<CreateSessionOptions["resourceLoader"]>;

type LibrarianModel = NonNullable<CreateSessionOptions["model"]>;
type LibrarianThinkingLevel = CreateSessionOptions["thinkingLevel"];
type LibrarianAuthStorage = CreateSessionOptions["authStorage"];
type LibrarianModelRegistry = CreateSessionOptions["modelRegistry"];

export type LibrarianPhase = "starting" | "researching" | "gathering" | "synthesizing";

export interface LibrarianProgress {
  phase: LibrarianPhase;
  summary: string;
}

export interface LibrarianResultDetails {
  role: "librarian";
  task: string;
  filesUsed: string[];
  repoHints: string[];
  constraints: string;
  model: string;
  findings: string;
  evidence: string;
  limitations: string;
  citations: string[];
  degraded: boolean;
  sources: LibrarianEvidenceItem[];
  passes: LibrarianResearchPass[];
  researchLimitations: string[];
}

export interface LibrarianSubagentResult {
  text: string;
  details: LibrarianResultDetails;
}

export interface LibrarianSubagentInput {
  cwd: string;
  model: LibrarianModel;
  thinkingLevel?: LibrarianThinkingLevel;
  authStorage?: LibrarianAuthStorage;
  modelRegistry?: LibrarianModelRegistry;
  task: string;
  files?: string[];
  repos?: string[];
  constraints?: string;
}

export interface LibrarianSubagentDeps {
  createSession?: CreateSession;
  createLoader?: (input: { cwd: string }) => Promise<ResourceLoader>;
  createResearch?: (input: Pick<LibrarianSubagentInput, "task" | "repos" | "constraints">, deps?: { onProgress?: (progress: LibrarianResearchProgress) => void }) => Promise<LibrarianResearchResult>;
  onProgress?: (progress: LibrarianProgress) => void;
}

function isTextPart(part: unknown): part is { type: "text"; text: string } {
  return (
    !!part &&
    typeof part === "object" &&
    (part as { type?: unknown }).type === "text" &&
    typeof (part as { text?: unknown }).text === "string"
  );
}

function getLastAssistantText(messages: AgentSession["messages"]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message || message.role !== "assistant" || !("content" in message) || !Array.isArray(message.content)) {
      continue;
    }

    const textPart = message.content.find(isTextPart);
    if (textPart) return textPart.text;
  }
  return "";
}

export function buildLibrarianSessionOptions({
  cwd,
  model,
  thinkingLevel,
  authStorage,
  modelRegistry,
  resourceLoader,
}: {
  cwd: string;
  model: LibrarianModel;
  thinkingLevel?: LibrarianThinkingLevel;
  authStorage?: LibrarianAuthStorage;
  modelRegistry?: LibrarianModelRegistry;
  resourceLoader: ResourceLoader;
}): CreateSessionOptions {
  return {
    cwd,
    model,
    ...(thinkingLevel ? { thinkingLevel } : {}),
    ...(authStorage ? { authStorage } : {}),
    ...(modelRegistry ? { modelRegistry } : {}),
    resourceLoader,
    sessionManager: SessionManager.inMemory(),
    settingsManager: SettingsManager.inMemory({
      compaction: { enabled: false },
    }),
    tools: createReadOnlyTools(cwd),
  };
}

async function defaultCreateLoader({ cwd }: { cwd: string }): Promise<DefaultResourceLoader> {
  const loader = new DefaultResourceLoader({
    cwd,
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    agentsFilesOverride: () => ({ agentsFiles: [] }),
    systemPromptOverride: () => LIBRARIAN_SYSTEM_PROMPT,
  });
  await loader.reload();
  return loader;
}

export async function runLibrarianSubagent(
  input: LibrarianSubagentInput,
  deps: LibrarianSubagentDeps = {},
): Promise<LibrarianSubagentResult> {
  const {
    createSession = createAgentSession,
    createLoader = defaultCreateLoader,
    createResearch = runLibrarianResearch,
    onProgress,
  } = deps;

  if (!input.model) {
    throw new Error("Librarian requires an active model from the parent session.");
  }

  onProgress?.({ phase: "starting", summary: "Librarian is preparing its research plan." });

  const research = await createResearch(
    {
      task: input.task,
      repos: input.repos || [],
      constraints: input.constraints || "",
    },
    {
      onProgress: (progress) => {
        onProgress?.({
          phase: "researching",
          summary: progress.summary,
        });
      },
    },
  );

  const prompt = buildLibrarianPrompt({
    task: input.task,
    files: input.files || [],
    repos: input.repos || [],
    ...(input.constraints ? { constraints: input.constraints } : {}),
    publicEvidence: research.evidence,
    publicPasses: research.passes,
    researchLimitations: research.limitations,
    degraded: research.degraded,
  });
  const resourceLoader = await createLoader({ cwd: input.cwd });
  const options = buildLibrarianSessionOptions({
    cwd: input.cwd,
    model: input.model,
    thinkingLevel: input.thinkingLevel,
    authStorage: input.authStorage,
    modelRegistry: input.modelRegistry,
    resourceLoader,
  });

  onProgress?.({ phase: "starting", summary: "Librarian is preparing its local research session." });
  const { session } = await createSession(options);

  let lastToolName: string | null = null;
  const unsubscribe = session.subscribe((event) => {
    if (event.type === "tool_execution_start") {
      lastToolName = event.toolName;
      onProgress?.({
        phase: "gathering",
        summary: `Librarian is gathering local evidence with ${event.toolName}.`,
      });
    }
    if (event.type === "message_end" && event.message && event.message.role === "assistant") {
      onProgress?.({
        phase: "synthesizing",
        summary: lastToolName
          ? `Librarian finished ${lastToolName} and is organizing findings.`
          : "Librarian is organizing findings.",
      });
    }
  });

  try {
    await session.prompt(prompt, { source: "extension" });
    const text = getLastAssistantText(session.messages);
    const normalized = normalizeLibrarianResult(text);
    return {
      text: normalized.rawText,
      details: {
        role: "librarian",
        task: input.task,
        filesUsed: input.files || [],
        repoHints: input.repos || [],
        constraints: input.constraints || "",
        model: input.model.id,
        findings: normalized.findings,
        evidence: normalized.evidence,
        limitations: normalized.limitations,
        citations: [...new Set([...normalized.citations, ...research.evidence.map((item) => item.citation)])],
        degraded: normalized.degraded || research.degraded,
        sources: research.evidence,
        passes: research.passes,
        researchLimitations: research.limitations,
      },
    };
  } finally {
    unsubscribe();
    session.dispose();
  }
}
