import { Ollama } from "ollama";
import type { Message, Tool } from "ollama";
import type { McpClient, McpTool } from "../mcp-client/index.js";
import type { Config } from "../config.js";

const SYSTEM_PROMPT = `You are an expert assistant for LemonLDAP::NG (LLNG),
a web Single Sign-On and Access Management solution.

You help operators diagnose and fix issues with their LLNG installation.
You have access to tools that can inspect configuration, sessions,
and manage multiple LLNG instances.

Guidelines:
- Always check current state before drawing conclusions
- Be concise and actionable in your responses
- When suggesting configuration changes, always explain the impact
- For destructive actions (purging sessions, restarting services), ask for confirmation
- Use the "instance" parameter on tools to target a specific LLNG instance
- Use llng_instances to list available instances when needed
- You can respond in French or English, matching the operator's language
/no_think`;

// Only expose essential tools to the LLM to keep prompt small (CPU-friendly).
// All tools remain callable — only the LLM's awareness is limited.
const CORE_TOOLS = new Set([
  "llng_instances",
  "llng_version",
  "llng_health",
  "llng_config_info",
  "llng_config_get",
  "llng_config_set",
  "llng_session_search",
  "llng_session_get",
  "llng_session_delete",
  "llng_2fa_list",
  "llng_doc_search",
]);

function isCoreTool(name: string): boolean {
  return CORE_TOOLS.has(name);
}

function mcpToolToOllamaTool(tool: McpTool): Tool {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema as Tool["function"]["parameters"],
    },
  };
}

export class Orchestrator {
  private ollama: Ollama;
  private tools: Tool[] = [];
  private history: Message[] = [];

  constructor(
    private config: Config,
    private mcpClient: McpClient
  ) {
    const ollamaHost = process.env.OLLAMA_URL ?? "http://localhost:11434";
    const timeoutMs = 10 * 60 * 1000; // 10 minutes
    this.ollama = new Ollama({
      host: ollamaHost,
      fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) }),
    });
  }

  async initialize(): Promise<void> {
    const mcpTools = await this.mcpClient.listTools();
    const coreTools = mcpTools.filter((t) => isCoreTool(t.name));
    this.tools = coreTools.map(mcpToolToOllamaTool);
    this.history = [{ role: "system", content: SYSTEM_PROMPT }];
  }

  async chat(userMessage: string): Promise<string> {
    this.history.push({ role: "user", content: userMessage });

    // Agentic loop: keep going until no more tool calls
    while (true) {
      const response = await this.ollama.chat({
        model: this.config.llm.model,
        messages: this.history,
        tools: this.tools,
      });

      const msg = response.message;
      this.history.push(msg);

      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        return msg.content;
      }

      // Execute all tool calls and feed results back
      for (const call of msg.tool_calls) {
        const toolName = call.function.name;
        const toolArgs = call.function.arguments as Record<string, unknown>;

        let toolResult: string;
        try {
          process.stderr.write(`\x1b[90m  [tool] ${toolName}(${JSON.stringify(toolArgs)})\x1b[0m\n`);
          toolResult = await this.mcpClient.callTool(toolName, toolArgs);
        } catch (err) {
          toolResult = `Error calling tool ${toolName}: ${err}`;
          process.stderr.write(`\x1b[31m  [error] ${toolResult}\x1b[0m\n`);
        }

        this.history.push({
          role: "tool",
          content: toolResult,
        });
      }
    }
  }

  resetHistory(): void {
    this.history = [{ role: "system", content: SYSTEM_PROMPT }];
  }
}
