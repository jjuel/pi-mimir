import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { Type, type Static } from "@sinclair/typebox";

import {
  runOracleSubagent,
  type OracleProgress,
  type OracleResultDetails,
  type OracleSubagentInput,
  type OracleSubagentResult,
} from "./runtime.js";

export const OracleParameters = Type.Object({
  task: Type.String({ description: "What Oracle should investigate or advise on." }),
  files: Type.Optional(
    Type.Array(Type.String(), {
      description: "Optional focus files for the advisory investigation.",
    }),
  ),
  constraints: Type.Optional(
    Type.String({ description: "Optional constraints or boundaries for the analysis." }),
  ),
});

export type OracleParams = Static<typeof OracleParameters>;

export type OracleToolDetails =
  | OracleResultDetails
  | {
      role: "oracle";
      phase?: OracleProgress["phase"];
      summary?: string;
    };

interface CreateOracleToolDeps {
  run?: (input: OracleSubagentInput, deps?: { onProgress?: (progress: OracleProgress) => void }) => Promise<OracleSubagentResult>;
  getThinkingLevel?: () => OracleSubagentInput["thinkingLevel"];
}

export function createOracleTool(
  deps: CreateOracleToolDeps = {},
): ToolDefinition<typeof OracleParameters, OracleToolDetails> {
  const { run = runOracleSubagent, getThinkingLevel = () => "medium" } = deps;

  return {
    name: "oracle",
    label: "Oracle",
    description:
      "Read-only advisory subagent for deep analysis, design review, debugging, and recommendation.",
    promptSnippet:
      "Use oracle for careful read-only analysis when the user wants a second opinion or deeper reasoning.",
    promptGuidelines: [
      "Use oracle when the task is primarily investigative or advisory rather than code-writing.",
      "Pass focus files when the user already pointed at relevant local context.",
    ],
    parameters: OracleParameters,
    async execute(_toolCallId, params, _signal, onUpdate, ctx) {
      onUpdate?.({
        content: [{ type: "text", text: "Oracle is starting its advisory pass." }],
        details: { phase: "starting", role: "oracle" },
      });

      if (!ctx.model) {
        throw new Error("Oracle requires an active model from the parent session.");
      }

      const result = await run(
        {
          cwd: ctx.cwd,
          model: ctx.model,
          thinkingLevel: getThinkingLevel(),
          authStorage: ctx.modelRegistry?.authStorage,
          modelRegistry: ctx.modelRegistry,
          task: params.task,
          files: params.files || [],
          constraints: params.constraints || "",
        },
        {
          onProgress: (progress) => {
            onUpdate?.({
              content: [{ type: "text", text: progress.summary }],
              details: { role: "oracle", ...progress },
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
