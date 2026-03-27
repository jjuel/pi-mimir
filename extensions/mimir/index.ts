import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import { createConsultCommand, createConsultTool } from "../../src/consult/tool.js";
import { createLibrarianCommand, createLibrarianTool } from "../../src/librarian/tool.js";
import { createOracleCommand, createOracleTool } from "../../src/oracle/tool.js";

export default function mimirExtension(pi: ExtensionAPI): void {
  pi.registerTool(
    createOracleTool({
      getThinkingLevel: () => pi.getThinkingLevel(),
    }),
  );
  pi.registerCommand(
    "oracle",
    createOracleCommand({
      getThinkingLevel: () => pi.getThinkingLevel(),
      sendMessage: (...args) => pi.sendMessage(...args),
    }),
  );

  pi.registerTool(
    createLibrarianTool({
      getThinkingLevel: () => pi.getThinkingLevel(),
    }),
  );
  pi.registerCommand(
    "librarian",
    createLibrarianCommand({
      getThinkingLevel: () => pi.getThinkingLevel(),
      sendMessage: (...args) => pi.sendMessage(...args),
    }),
  );

  pi.registerTool(
    createConsultTool({
      getThinkingLevel: () => pi.getThinkingLevel(),
    }),
  );
  pi.registerCommand(
    "consult",
    createConsultCommand({
      getThinkingLevel: () => pi.getThinkingLevel(),
      sendMessage: (...args) => pi.sendMessage(...args),
    }),
  );
}
