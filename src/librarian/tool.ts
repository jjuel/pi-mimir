import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { Type, type Static } from "@sinclair/typebox";

import {
  runLibrarianSubagent,
  type LibrarianProgress,
  type LibrarianResultDetails,
  type LibrarianSubagentInput,
  type LibrarianSubagentResult,
} from "./runtime.js";

export const LibrarianParameters = Type.Object({
  task: Type.String({ description: "What Librarian should investigate using local and public research." }),
  files: Type.Optional(
    Type.Array(Type.String(), {
      description: "Optional focus files for the investigation. These are hints, not strict boundaries.",
    }),
  ),
  repos: Type.Optional(
    Type.Array(Type.String(), {
      description: "Optional repository hints for public code research. These are soft preferences, not a strict allowlist.",
    }),
  ),
  constraints: Type.Optional(
    Type.String({ description: "Optional constraints or boundaries for the investigation." }),
  ),
});

export type LibrarianParams = Static<typeof LibrarianParameters>;

export type LibrarianToolDetails =
  | LibrarianResultDetails
  | {
      role: "librarian";
      phase?: LibrarianProgress["phase"];
      summary?: string;
    };

interface CreateLibrarianToolDeps {
  run?: (
    input: LibrarianSubagentInput,
    deps?: { onProgress?: (progress: LibrarianProgress) => void },
  ) => Promise<LibrarianSubagentResult>;
  getThinkingLevel?: () => LibrarianSubagentInput["thinkingLevel"];
}

export function createLibrarianTool(
  deps: CreateLibrarianToolDeps = {},
): ToolDefinition<typeof LibrarianParameters, LibrarianToolDetails> {
  const { run = runLibrarianSubagent, getThinkingLevel = () => "medium" } = deps;

  return {
    name: "librarian",
    label: "Librarian",
    description:
      "Read-only research subagent for evidence-backed investigation across local context, public code, and public web sources.",
    promptSnippet:
      "Use librarian for evidence-backed research when the user wants findings with citations from local files, public repos, or public web sources.",
    promptGuidelines: [
      "Use librarian when the task calls for grounded findings and explicit evidence rather than pure advice.",
      "Pass file and repo hints when the user identified likely hotspots, but treat them as soft hints rather than hard boundaries.",
    ],
    parameters: LibrarianParameters,
    async execute(_toolCallId, params, _signal, onUpdate, ctx) {
      onUpdate?.({
        content: [{ type: "text", text: "Librarian is starting its research pass." }],
        details: { phase: "starting", role: "librarian" },
      });

      if (!ctx.model) {
        throw new Error("Librarian requires an active model from the parent session.");
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
          repos: params.repos || [],
          constraints: params.constraints || "",
        },
        {
          onProgress: (progress) => {
            onUpdate?.({
              content: [{ type: "text", text: progress.summary }],
              details: { role: "librarian", ...progress },
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
