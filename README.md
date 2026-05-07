# llng-assistant

LemonLDAP::NG maintenance assistant powered by a local LLM.

Designed for operators who rarely deal with incidents — when your SSO breaks
at 11 PM on a Friday, this tool helps you diagnose and fix it without having
to read through the documentation.

## How it works

```
You (natural language)
  → Local LLM (Mistral Nemo / Qwen 2.5)
    → llng-mcp (MCP server instances)
      → Multiple LLNG servers (SSH, Docker, Kubernetes, API)
```

The LLM runs entirely on your workstation. Nothing leaves your network.

Supports managing **multiple LLNG instances simultaneously** — compare
configurations, search sessions across servers, or troubleshoot one instance
while monitoring another.

The documentation index (built from LLNG source RST files) is embedded in
the Docker image and updated with each release.

## Requirements

- Linux or macOS workstation with 8+ GB RAM (16+ GB recommended for 12b models)
- Node.js 20+
- [Ollama](https://ollama.com/) — local LLM runtime
- Network access to your LLNG servers (SSH, kubectl, or HTTP API)

## Installation

### 1. Install Ollama

Ollama runs LLMs on your machine or on a remote server. Install it:

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Start the server (runs on `http://localhost:11434`):

```bash
ollama serve
```

**Remote Ollama server (recommended for teams):** If you have a server with
a GPU, install Ollama there and point llng-assistant to it. Operators run the
assistant on their laptops — only HTTP requests are sent to the Ollama server,
no GPU needed locally:

```bash
OLLAMA_URL=http://gpu-server:11434 npm start
```

### 2. Download an LLM

Choose a model based on your hardware:

| Model              | Download | RAM/VRAM needed          | Speed  | Quality    |
| ------------------ | -------- | ------------------------ | ------ | ---------- |
| `qwen3:4b`         | 2.6 GB   | 8 GB                     | Fast   | Acceptable |
| `qwen3:8b`         | 5.2 GB   | 8 GB (GPU) / 16 GB (CPU) | Medium | Good       |
| `mistral-nemo:12b` | 5.1 GB   | 16 GB                    | Medium | Better     |
| `qwen2.5:14b`      | 8.1 GB   | 16 GB                    | Slow   | Best       |

**With GPU (NVIDIA, Apple Silicon):** any model works well.
**CPU only:** use `qwen3:4b` — larger models will be too slow for tool calling.

```bash
ollama pull qwen3:8b
```

### 3. Install llng-assistant

```bash
git clone https://github.com/linagora/llng-assistant.git
cd llng-assistant
npm install
npm run build
```

### 4. Configure your LLNG instances

Create `~/.config/llng-assistant/config.yaml`:

```yaml
llm:
  model: qwen3:8b
```

Then configure your LLNG instances in `~/.llng-mcp.json` — see
[Configuration](#configuration) below.

### 5. (Optional) Build the documentation index

This enables semantic search over the LLNG documentation:

```bash
ollama pull nomic-embed-text
npm run build-index -- --src /path/to/lemonldap-ng/doc/sources/admin
```

### Docker installation (alternative)

```bash
curl -fsSL https://raw.githubusercontent.com/linagora/llng-assistant/main/install.sh | bash
```

The script handles Docker, Ollama, model download, and systemd service setup.

## Usage

```bash
llng-assistant
```

Example interactions (in French or English):

```
> Pourquoi les utilisateurs ne peuvent plus se connecter sur production ?
> Combien de sessions actives sur production ?
> Compare la config OIDC entre production et staging
> Cherche les sessions de dupont sur staging
> Montre-moi les dernières erreurs SAML sur production
> Quelle est la configuration du vhost app.example.com sur staging ?
> Comment configurer l'authentification Kerberos ?
```

All tools are automatically prefixed with their instance name, so the LLM knows which
LLNG server to query. Ask questions about specific instances by name.

## Configuration

Settings are stored in `~/.config/llng-assistant/config.yaml` after installation.

The LLM model is configured here. LLNG instances are configured separately via
llng-mcp.

### Minimal config

```yaml
llm:
  model: mistral-nemo:12b # auto-selected based on available RAM

mcp_config: ~/.llng-mcp.json
```

Then configure your LLNG instances in `~/.llng-mcp.json` (standard MCP format):

```json
{
  "mcpServers": {
    "production": {
      "command": "npx",
      "args": ["-y", "llng-mcp"],
      "env": {
        "LLNG_MODE": "ssh",
        "LLNG_SSH_HOST": "sso.example.com",
        "LLNG_SSH_USER": "admin"
      }
    },
    "staging": {
      "command": "npx",
      "args": ["-y", "llng-mcp"],
      "env": {
        "LLNG_MODE": "k8s",
        "LLNG_K8S_CONTEXT": "staging-cluster",
        "LLNG_K8S_NAMESPACE": "auth",
        "LLNG_K8S_POD_SELECTOR": "app=lemonldap-portal"
      }
    }
  }
}
```

### Inline instances (alternative)

Instead of `mcp_config`, you can define instances directly:

```yaml
llm:
  model: mistral-nemo:12b

instances:
  production:
    command: npx
    args: ["-y", "llng-mcp"]
    env:
      LLNG_MODE: ssh
      LLNG_SSH_HOST: sso.example.com
      LLNG_SSH_USER: admin

  staging:
    command: npx
    args: ["-y", "llng-mcp"]
    env:
      LLNG_MODE: k8s
      LLNG_K8S_CONTEXT: staging-cluster
      LLNG_K8S_NAMESPACE: auth
      LLNG_K8S_POD_SELECTOR: "app=lemonldap-portal"
```

For detailed llng-mcp configuration options, see the
[llng-mcp documentation](https://github.com/linagora/llng-mcp).

## Documentation index

The assistant includes semantic search over the LLNG documentation, powered by
`nomic-embed-text` embeddings via Ollama. The pre-built index is included in
Docker images and updated with each release. See step 5 above to rebuild it
from source.

## Related projects

This tool is built on top of:

- [llng-mcp](https://github.com/linagora/llng-mcp) — MCP server for LLNG diagnostics
- [LemonLDAP::NG](https://lemonldap-ng.io/) — The excellent SSO platform we maintain

## License

AGPL-3.0 — Copyright [LINAGORA](https://linagora.com)
