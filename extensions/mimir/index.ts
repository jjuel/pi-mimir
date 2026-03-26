import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import { createOracleTool } from "../../src/oracle/tool.js";

export default function mimirExtension(pi: ExtensionAPI): void {
  pi.registerTool(
    createOracleTool({
      getThinkingLevel: () => pi.getThinkingLevel(),
    }),
  );
}
