import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { McpServerConfig } from "../config.js";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: object;
}

interface InstanceConnection {
  name: string;
  client: Client;
  transport: StdioClientTransport;
}

export class McpClient {
  private connections: InstanceConnection[] = [];

  constructor(private instances: Record<string, McpServerConfig>) {}

  async connect(): Promise<void> {
    for (const [name, config] of Object.entries(this.instances)) {
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: { ...process.env, ...config.env } as Record<string, string>,
      });
      const client = new Client(
        { name: `llng-assistant/${name}`, version: "0.1.0" },
        {}
      );
      await client.connect(transport);
      this.connections.push({ name, client, transport });
    }
  }

  async listTools(): Promise<McpTool[]> {
    const allTools: McpTool[] = [];

    for (const conn of this.connections) {
      const result = await conn.client.listTools();
      for (const tool of result.tools) {
        allTools.push({
          name: `${conn.name}/${tool.name}`,
          description: `[${conn.name}] ${tool.description}`,
          inputSchema: tool.inputSchema as object,
        });
      }
    }

    return allTools;
  }

  async callTool(prefixedName: string, args: Record<string, unknown>): Promise<string> {
    const slashIdx = prefixedName.indexOf("/");
    if (slashIdx === -1) {
      throw new Error(`Invalid tool name "${prefixedName}": expected "instance/tool_name"`);
    }

    const instanceName = prefixedName.slice(0, slashIdx);
    const toolName = prefixedName.slice(slashIdx + 1);

    const conn = this.connections.find((c) => c.name === instanceName);
    if (!conn) {
      throw new Error(`Unknown instance "${instanceName}". Available: ${this.connections.map(c => c.name).join(", ")}`);
    }

    const result = await conn.client.callTool({ name: toolName, arguments: args });
    const content = result.content as Array<{ type: string; text?: string }>;
    return content
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n");
  }

  async close(): Promise<void> {
    for (const conn of this.connections) {
      await conn.client.close();
    }
  }

  getInstanceNames(): string[] {
    return this.connections.map((c) => c.name);
  }
}
