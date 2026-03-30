import * as readline from "readline";
import { loadConfig } from "../config.js";
import { McpClient } from "../mcp-client/index.js";
import { Orchestrator } from "../orchestrator/index.js";

const BANNER = `
  llng-assistant — LemonLDAP::NG maintenance assistant
  Type your question in French or English. Ctrl+C to exit.
  Commands: /reset (new conversation), /quit
`;

async function main() {
  const config = loadConfig();

  console.log(BANNER);
  console.log(`  Model     : ${config.llm.model}`);
  const names = Object.keys(config.instances);
  if (names.length > 0) {
    console.log(`  Instances : ${names.join(", ")}`);
  } else {
    console.log(`  Instances : (none configured)`);
  }
  console.log("");

  const mcpClient = new McpClient(config.instances);
  await mcpClient.connect();

  const orchestrator = new Orchestrator(config, mcpClient);
  await orchestrator.initialize();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  const prompt = () => rl.question("\x1b[32m>\x1b[0m ", async (input) => {
    const line = input.trim();

    if (!line) {
      return prompt();
    }

    if (line === "/quit") {
      await mcpClient.close();
      rl.close();
      return;
    }

    if (line === "/reset") {
      orchestrator.resetHistory();
      console.log("  Conversation reset.\n");
      return prompt();
    }

    try {
      process.stdout.write("\x1b[90m  Thinking...\x1b[0m\r");
      const answer = await orchestrator.chat(line);
      process.stdout.write("                \r"); // clear "Thinking..."
      console.log(`\n${answer}\n`);
    } catch (err) {
      console.error(`\n  Error: ${err}\n`);
    }

    prompt();
  });

  prompt();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
