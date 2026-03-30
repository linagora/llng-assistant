import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import yaml from "js-yaml";

export interface Config {
  llm: {
    model: string;
  };
}

const DEFAULT_CONFIG: Config = {
  llm: { model: "mistral-nemo:12b" },
};

export function loadConfig(): Config {
  const configPath =
    process.env.CONFIG_PATH ??
    resolve(process.env.HOME ?? "~", ".config/llng-assistant/config.yaml");

  if (!existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }

  const raw = readFileSync(configPath, "utf-8");
  const loaded = yaml.load(raw) as Partial<Config>;
  return { ...DEFAULT_CONFIG, ...loaded };
}
