import { Ollama } from "ollama";
import type { Message, Tool } from "ollama";
import type { McpClient, McpTool } from "../mcp-client/index.js";
import type { Config } from "../config.js";

function buildSystemPrompt(instanceNames: string[]): string {
  const instanceList = instanceNames.length > 0
    ? `\n\nYou manage the following LLNG instances: ${instanceNames.join(", ")}.\nAll tools are prefixed with the instance name (e.g., "${instanceNames[0]}/llng_config_get").\nAlways use the correct instance prefix when calling tools.`
    : "";

  return `You are an expert assistant for LemonLDAP::NG (LLNG),
a web Single Sign-On and Access Management solution.

You help operators diagnose and fix issues with their LLNG installation.
You have access to tools that can inspect logs, configuration, sessions,
and search the LLNG documentation.

Guidelines:
- Always check logs and current state before drawing conclusions
- Search the documentation when asked about configuration or features
- Be concise and actionable in your responses
- When suggesting configuration changes, always explain the impact
- For destructive actions (purging sessions, restarting services), ask for confirmation
- You can respond in French or English, matching the operator's language${instanceList}`;
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
    this.ollama = new Ollama({
      host: process.env.OLLAMA_URL ?? "http://localhost:11434",
    });
  }

  async initialize(): Promise<void> {
    const mcpTools = await this.mcpClient.listTools();
    this.tools = mcpTools.map(mcpToolToOllamaTool);
    const instanceNames = this.mcpClient.getInstanceNames();
    this.history = [{ role: "system", content: buildSystemPrompt(instanceNames) }];
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
          toolResult = await this.mcpClient.callTool(toolName, toolArgs);
        } catch (err) {
          toolResult = `Error calling tool ${toolName}: ${err}`;
        }

        this.history.push({
          role: "tool",
          content: toolResult,
        });
      }
    }
  }

  resetHistory(): void {
    const instanceNames = this.mcpClient.getInstanceNames();
    this.history = [{ role: "system", content: buildSystemPrompt(instanceNames) }];
  }
}
