import {
  DefaultResourceLoader,
  SessionManager,
  SettingsManager,
  createAgentSession,
  createReadOnlyTools,
} from "@mariozechner/pi-coding-agent";

import { ORACLE_SYSTEM_PROMPT, buildOraclePrompt, normalizeOracleResult } from "./prompt.js";

type CreateSession = typeof createAgentSession;
type CreateSessionOptions = NonNullable<Parameters<CreateSession>[0]>;
type CreateSessionResult = Awaited<ReturnType<CreateSession>>;
type AgentSession = CreateSessionResult["session"];
type ResourceLoader = NonNullable<CreateSessionOptions["resourceLoader"]>;

type OracleModel = NonNullable<CreateSessionOptions["model"]>;
type OracleThinkingLevel = CreateSessionOptions["thinkingLevel"];
type OracleAuthStorage = CreateSessionOptions["authStorage"];
type OracleModelRegistry = CreateSessionOptions["modelRegistry"];

export type OraclePhase = "starting" | "inspecting" | "synthesizing";

export interface OracleProgress {
  phase: OraclePhase;
  summary: string;
}

export interface OracleResultDetails {
  role: "oracle";
  task: string;
  filesUsed: string[];
  constraints: string;
  model: string;
  conclusion: string;
  reasoning: string;
  risks: string;
  recommendation: string;
  limitations: string;
  degraded: boolean;
}

export interface OracleSubagentResult {
  text: string;
  details: OracleResultDetails;
}

export interface OracleSubagentInput {
  cwd: string;
  model: OracleModel;
  thinkingLevel?: OracleThinkingLevel;
  authStorage?: OracleAuthStorage;
  modelRegistry?: OracleModelRegistry;
  task: string;
  files?: string[];
  constraints?: string;
}

export interface OracleSubagentDeps {
  createSession?: CreateSession;
  createLoader?: (input: { cwd: string }) => Promise<ResourceLoader>;
  onProgress?: (progress: OracleProgress) => void;
}

function isTextPart(part: unknown): part is { type: "text"; text: string } {
  return !!part && typeof part === "object" && (part as { type?: unknown }).type === "text" && typeof (part as { text?: unknown }).text === "string";
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

export function buildOracleSessionOptions({
  cwd,
  model,
  thinkingLevel,
  authStorage,
  modelRegistry,
  resourceLoader,
}: {
  cwd: string;
  model: OracleModel;
  thinkingLevel?: OracleThinkingLevel;
  authStorage?: OracleAuthStorage;
  modelRegistry?: OracleModelRegistry;
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
    systemPromptOverride: () => ORACLE_SYSTEM_PROMPT,
  });
  await loader.reload();
  return loader;
}

export async function runOracleSubagent(
  input: OracleSubagentInput,
  deps: OracleSubagentDeps = {},
): Promise<OracleSubagentResult> {
  const { createSession = createAgentSession, createLoader = defaultCreateLoader, onProgress } = deps;

  if (!input.model) {
    throw new Error("Oracle requires an active model from the parent session.");
  }

  const prompt = buildOraclePrompt(input);
  const resourceLoader = await createLoader({ cwd: input.cwd });
  const options = buildOracleSessionOptions({
    cwd: input.cwd,
    model: input.model,
    thinkingLevel: input.thinkingLevel,
    authStorage: input.authStorage,
    modelRegistry: input.modelRegistry,
    resourceLoader,
  });

  onProgress?.({ phase: "starting", summary: "Oracle is preparing its isolated session." });
  const { session } = await createSession(options);

  let lastToolName: string | null = null;
  const unsubscribe = session.subscribe((event) => {
    if (event.type === "tool_execution_start") {
      lastToolName = event.toolName;
      onProgress?.({
        phase: "inspecting",
        summary: `Oracle is using ${event.toolName}.`,
      });
    }
    if (event.type === "message_end" && event.message && event.message.role === "assistant") {
      onProgress?.({
        phase: "synthesizing",
        summary: lastToolName
          ? `Oracle finished ${lastToolName} and is synthesizing advice.`
          : "Oracle is synthesizing advice.",
      });
    }
  });

  try {
    await session.prompt(prompt, { source: "extension" });
    const text = getLastAssistantText(session.messages);
    const normalized = normalizeOracleResult(text);
    return {
      text: normalized.rawText,
      details: {
        role: "oracle",
        task: input.task,
        filesUsed: input.files || [],
        constraints: input.constraints || "",
        model: input.model.id,
        conclusion: normalized.conclusion,
        reasoning: normalized.reasoning,
        risks: normalized.risks,
        recommendation: normalized.recommendation,
        limitations: normalized.limitations,
        degraded: false,
      },
    };
  } finally {
    unsubscribe();
    session.dispose();
  }
}
