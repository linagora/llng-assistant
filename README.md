# llng-assistant

LemonLDAP::NG maintenance assistant powered by a local LLM.

Designed for operators who rarely deal with incidents — when your SSO breaks
at 11 PM on a Friday, this tool helps you diagnose and fix it without having
to read through the documentation.

## How it works

```
You (natural language)
  → Local LLM (Mistral Nemo / Qwen 2.5)
    → MCP tools (logs, config, sessions, documentation search)
      → Your LLNG server (via SSH, Docker, Kubernetes, or API)
```

The LLM runs entirely on your workstation. Nothing leaves your network.

The documentation index (built from LLNG source RST files) is embedded in
the Docker image and updated with each release.

## Requirements

- Linux workstation with 8+ GB RAM
- Docker
- SSH access to the LLNG server (existing keys and config are used as-is)

## Installation

```bash
curl -fsSL https://raw.githubusercontent.com/guimard/llng-assistant/main/install.sh | bash
```

The installer will:
1. Check / install Docker
2. Detect available RAM and suggest the best LLM
3. Pull the Docker image (includes the documentation index)
4. Download the LLM via Ollama (~5 GB)
5. Ask for your LLNG connection settings
6. Optionally install a systemd service

## Usage

```bash
llng-assistant
```

Example interactions (in French or English):

```
> Pourquoi les utilisateurs ne peuvent plus se connecter ?
> Montre-moi les dernières erreurs SAML
> Quelle est la configuration du vhost app.example.com ?
> Comment configurer l'authentification Kerberos ?
```

## Configuration

Settings are stored in `~/.config/llng-assistant/config.yaml` after installation.

```yaml
llng:
  host: sso.example.com
  ssh_user: admin
  manager_url: https://sso.example.com/manager/api
  api_key: your-api-key

# deployment type: ssh | docker | k8s | docker-over-ssh
deployment: ssh

llm:
  model: mistral-nemo:12b   # auto-selected based on available RAM
```

## Related project

This tool is built on top of
[llng-mcp](https://github.com/guimard/llng-mcp),
the MCP server exposing LLNG diagnostic and maintenance tools.

## License

LGPL-2.1 — same as LemonLDAP::NG
