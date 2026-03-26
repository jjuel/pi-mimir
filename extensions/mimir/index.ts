import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import { createConsultTool } from "../../src/consult/tool.js";
import { createLibrarianTool } from "../../src/librarian/tool.js";
import { createOracleTool } from "../../src/oracle/tool.js";

export default function mimirExtension(pi: ExtensionAPI): void {
  pi.registerTool(
    createOracleTool({
      getThinkingLevel: () => pi.getThinkingLevel(),
    }),
  );

  pi.registerTool(
    createLibrarianTool({
      getThinkingLevel: () => pi.getThinkingLevel(),
    }),
  );

  pi.registerTool(
    createConsultTool({
      getThinkingLevel: () => pi.getThinkingLevel(),
    }),
  );
}
