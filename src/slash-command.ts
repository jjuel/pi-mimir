import type {
  ExtensionAPI,
  ExtensionCommandContext,
  RegisteredCommand,
} from "@mariozechner/pi-coding-agent";

interface ProgressWithSummary {
  summary: string;
}

interface ResultWithTextAndDetails<TDetails = unknown> {
  text: string;
  details: TDetails;
}

interface CreateSubagentSlashCommandOptions<
  TInput,
  TProgress extends ProgressWithSummary,
  TResult extends ResultWithTextAndDetails,
> {
  name: string;
  description: string;
  usage: string;
  sendMessage: ExtensionAPI["sendMessage"];
  run: (input: TInput, deps?: { onProgress?: (progress: TProgress) => void }) => Promise<TResult>;
  buildInput: (task: string, ctx: ExtensionCommandContext) => TInput;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

export function createSubagentSlashCommand<
  TInput,
  TProgress extends ProgressWithSummary,
  TResult extends ResultWithTextAndDetails,
>(
  options: CreateSubagentSlashCommandOptions<TInput, TProgress, TResult>,
): Omit<RegisteredCommand, "name" | "sourceInfo"> {
  const { name, description, usage, sendMessage, run, buildInput } = options;

  return {
    description,
    handler: async (args, ctx) => {
      const task = args.trim();
      if (!task) {
        ctx.ui.notify(`Usage: ${usage}`, "warning");
        return;
      }

      if (!ctx.model) {
        ctx.ui.notify(`/${name} requires an active model. Select one with /model and try again.`, "error");
        return;
      }

      if (!ctx.isIdle()) {
        ctx.ui.notify(`Waiting for the current agent turn to finish before running /${name}.`, "info");
        await ctx.waitForIdle();
      }

      sendMessage({
        customType: "mimir-command-progress",
        content: `/${name} running…`,
        display: true,
        details: {
          command: name,
          stage: "started",
        },
      });

      try {
        const result = await run(buildInput(task, ctx), {
          onProgress: (progress) => {
            sendMessage({
              customType: "mimir-command-progress",
              content: `/${name} running…\n\n${progress.summary}`,
              display: true,
              details: {
                command: name,
                stage: "progress",
                progress,
              },
            });
          },
        });

        sendMessage({
          customType: "mimir-command-result",
          content: `## /${name}\n\n${result.text}`,
          display: true,
          details: {
            command: name,
            result: result.details,
          },
        });
        ctx.ui.notify(`/${name} completed.`, "info");
      } catch (error) {
        ctx.ui.notify(`/${name} failed: ${getErrorMessage(error)}`, "error");
      }
    },
  };
}
