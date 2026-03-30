import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import yaml from "js-yaml";

export interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface Config {
  llm: {
    model: string;
  };
  instances: Record<string, McpServerConfig>;
}

const DEFAULT_CONFIG: Config = {
  llm: { model: "mistral-nemo:12b" },
  instances: {},
};

export function loadConfig(): Config {
  const configPath =
    process.env.CONFIG_PATH ??
    resolve(process.env.HOME ?? "~", ".config/llng-assistant/config.yaml");

  if (!existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }

  const raw = readFileSync(configPath, "utf-8");
  const loaded = yaml.load(raw) as any;

  const config: Config = {
    llm: loaded?.llm ?? DEFAULT_CONFIG.llm,
    instances: {},
  };

  // If "mcp_config" points to a .mcp.json file, load instances from there
  if (loaded?.mcp_config) {
    const mcpPath = resolve(loaded.mcp_config.replace(/^~/, process.env.HOME ?? "~"));
    if (existsSync(mcpPath)) {
      const mcpRaw = JSON.parse(readFileSync(mcpPath, "utf-8"));
      if (mcpRaw.mcpServers) {
        for (const [name, server] of Object.entries(mcpRaw.mcpServers)) {
          const s = server as any;
          config.instances[name] = {
            command: s.command,
            args: s.args ?? [],
            env: s.env,
          };
        }
      }
    }
  }

  // Also support inline instances in the yaml
  if (loaded?.instances) {
    for (const [name, server] of Object.entries(loaded.instances)) {
      config.instances[name] = server as McpServerConfig;
    }
  }

  return config;
}
