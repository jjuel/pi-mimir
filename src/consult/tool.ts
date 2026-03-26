import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type, type Static } from "@sinclair/typebox";

import {
  runConsultSubagent,
  type ConsultMode,
  type ConsultProgress,
  type ConsultResultDetails,
  type ConsultSubagentInput,
  type ConsultSubagentResult,
} from "./runtime.js";

export const ConsultParameters = Type.Object({
  task: Type.String({ description: "What Consult should investigate and answer." }),
  files: Type.Optional(
    Type.Array(Type.String(), {
      description: "Optional focus files for the investigation. These are hints, not strict boundaries.",
    }),
  ),
  repos: Type.Optional(
    Type.Array(Type.String(), {
      description: "Optional repository hints for public research. These are soft preferences, not a strict allowlist.",
    }),
  ),
  constraints: Type.Optional(
    Type.String({ description: "Optional constraints or boundaries for the investigation." }),
  ),
  mode: Type.Optional(
    StringEnum(["automatic", "oracle", "librarian", "both"] as const, {
      description: "Optional routing override. Defaults to automatic.",
    }),
  ),
});

export type ConsultParams = Static<typeof ConsultParameters>;

export type ConsultToolDetails =
  | ConsultResultDetails
  | {
      role: "consult";
      phase?: ConsultProgress["phase"];
      summary?: string;
    };

interface CreateConsultToolDeps {
  run?: (
    input: ConsultSubagentInput,
    deps?: { onProgress?: (progress: ConsultProgress) => void },
  ) => Promise<ConsultSubagentResult>;
  getThinkingLevel?: () => ConsultSubagentInput["thinkingLevel"];
}

export function createConsultTool(
  deps: CreateConsultToolDeps = {},
): ToolDefinition<typeof ConsultParameters, ConsultToolDetails> {
  const { run = runConsultSubagent, getThinkingLevel = () => "medium" } = deps;

  return {
    name: "consult",
    label: "Consult",
    description:
      "Unified non-mutating research entrypoint that can route to librarian, oracle, or both and return one coherent answer.",
    promptSnippet:
      "Use consult as the default deep-research entrypoint when the user wants one answer and you may need librarian, oracle, or both.",
    promptGuidelines: [
      "Use consult as the default user-facing entrypoint when the task is primarily investigative, research-oriented, or planning-oriented.",
      "Set mode only when the user explicitly wants to force librarian-only, oracle-only, both, or automatic routing.",
    ],
    parameters: ConsultParameters,
    async execute(_toolCallId, params, _signal, onUpdate, ctx) {
      onUpdate?.({
        content: [{ type: "text", text: "Consult is starting its orchestration pass." }],
        details: { phase: "starting", role: "consult" },
      });

      if (!ctx.model) {
        throw new Error("Consult requires an active model from the parent session.");
      }

      const thinkingLevel = getThinkingLevel();
      const result = await run(
        {
          cwd: ctx.cwd,
          model: ctx.model,
          ...(thinkingLevel ? { thinkingLevel } : {}),
          ...(ctx.modelRegistry?.authStorage ? { authStorage: ctx.modelRegistry.authStorage } : {}),
          ...(ctx.modelRegistry ? { modelRegistry: ctx.modelRegistry } : {}),
          task: params.task,
          files: params.files || [],
          repos: params.repos || [],
          constraints: params.constraints || "",
          mode: (params.mode as ConsultMode | undefined) || "automatic",
        },
        {
          onProgress: (progress) => {
            onUpdate?.({
              content: [{ type: "text", text: progress.summary }],
              details: { role: "consult", ...progress },
            });
          },
        },
      );

      return {
        content: [{ type: "text", text: result.text }],
        details: result.details,
      };
    },
  };
}
