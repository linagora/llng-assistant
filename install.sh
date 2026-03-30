#!/usr/bin/env bash
set -euo pipefail

REPO="guimard/llng-assistant"
CONFIG_DIR="${HOME}/.config/llng-assistant"
CONFIG_FILE="${CONFIG_DIR}/config.yaml"
COMPOSE_FILE="${CONFIG_DIR}/docker-compose.yml"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()    { echo -e "${BLUE}→${NC} $*"; }
success() { echo -e "${GREEN}✓${NC} $*"; }
warn()    { echo -e "${YELLOW}!${NC} $*"; }
error()   { echo -e "${RED}✗${NC} $*"; exit 1; }
ask()     { echo -e "${YELLOW}?${NC} $*"; }

echo ""
echo "  llng-assistant installer"
echo "  LemonLDAP::NG maintenance assistant"
echo ""

# ── Docker ────────────────────────────────────────────────────────────────────

if ! command -v docker &>/dev/null; then
  warn "Docker not found"
  ask "Install Docker automatically? [Y/n]"
  read -r INSTALL_DOCKER
  if [[ "${INSTALL_DOCKER,,}" != "n" ]]; then
    info "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$USER"
    warn "You may need to log out and back in for Docker group membership to take effect"
  else
    error "Docker is required. Please install it manually: https://docs.docker.com/engine/install/"
  fi
fi
success "Docker found: $(docker --version)"

# ── RAM detection and model selection ─────────────────────────────────────────

TOTAL_RAM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
TOTAL_RAM_GB=$(( TOTAL_RAM_KB / 1024 / 1024 ))

if (( TOTAL_RAM_GB >= 16 )); then
  DEFAULT_MODEL="mistral-nemo:12b"
  MODEL_SIZE="5.1 GB"
else
  DEFAULT_MODEL="qwen2.5:7b"
  MODEL_SIZE="4.7 GB"
fi

echo ""
info "RAM detected: ${TOTAL_RAM_GB} GB"
info "Recommended model: ${DEFAULT_MODEL} (${MODEL_SIZE} download)"
ask "Use this model? [Y/n]"
read -r USE_DEFAULT
if [[ "${USE_DEFAULT,,}" == "n" ]]; then
  echo "Available models:"
  echo "  1) qwen2.5:7b        (4.7 GB, 8 GB RAM minimum)"
  echo "  2) mistral-nemo:12b  (5.1 GB, 16 GB RAM recommended)"
  echo "  3) qwen2.5:14b       (8.1 GB, 16 GB RAM recommended)"
  ask "Choose [1-3]:"
  read -r MODEL_CHOICE
  case "$MODEL_CHOICE" in
    1) LLM_MODEL="qwen2.5:7b" ;;
    2) LLM_MODEL="mistral-nemo:12b" ;;
    3) LLM_MODEL="qwen2.5:14b" ;;
    *) LLM_MODEL="$DEFAULT_MODEL" ;;
  esac
else
  LLM_MODEL="$DEFAULT_MODEL"
fi
success "Model selected: ${LLM_MODEL}"

# ── Write config ───────────────────────────────────────────────────────────────

mkdir -p "$CONFIG_DIR"

cat > "$CONFIG_FILE" <<EOF
llm:
  model: ${LLM_MODEL}
EOF
success "Config written to ${CONFIG_FILE}"

echo ""
info "LLNG connection settings are managed by llng-mcp."
info "Configure your LLNG server in ~/.llng-mcp.json before starting llng-assistant."
info "See: https://www.npmjs.com/package/llng-mcp"

# ── docker-compose ─────────────────────────────────────────────────────────────

cat > "$COMPOSE_FILE" <<EOF
services:
  ollama:
    image: ollama/ollama
    volumes:
      - ollama-data:/root/.ollama
    ports:
      - "11434:11434"
    restart: unless-stopped

  llng-assistant:
    image: ghcr.io/${REPO}:latest
    volumes:
      - ${CONFIG_FILE}:/config/config.yaml:ro
      - ${HOME}/.ssh:/root/.ssh:ro
    environment:
      - OLLAMA_URL=http://ollama:11434
      - LLM_MODEL=${LLM_MODEL}
    depends_on:
      - ollama
    stdin_open: true
    tty: true
    restart: unless-stopped

volumes:
  ollama-data:
EOF
success "Docker Compose written to ${COMPOSE_FILE}"

# ── Pull image and model ───────────────────────────────────────────────────────

echo ""
info "Pulling llng-assistant image..."
docker compose -f "$COMPOSE_FILE" pull

info "Starting Ollama..."
docker compose -f "$COMPOSE_FILE" up -d ollama

info "Downloading LLM model ${LLM_MODEL} (~${MODEL_SIZE})..."
docker compose -f "$COMPOSE_FILE" exec ollama ollama pull "${LLM_MODEL}"
success "Model ready"

# ── CLI wrapper ────────────────────────────────────────────────────────────────

WRAPPER="/usr/local/bin/llng-assistant"
sudo tee "$WRAPPER" > /dev/null <<EOF
#!/usr/bin/env bash
docker compose -f ${COMPOSE_FILE} run --rm llng-assistant "\$@"
EOF
sudo chmod +x "$WRAPPER"
success "CLI wrapper installed: llng-assistant"

# ── Optional systemd service ───────────────────────────────────────────────────

echo ""
ask "Install as a systemd service (auto-start on boot)? [y/N]"
read -r INSTALL_SERVICE
if [[ "${INSTALL_SERVICE,,}" == "y" ]]; then
  sudo tee /etc/systemd/system/llng-assistant.service > /dev/null <<EOF
[Unit]
Description=llng-assistant (Ollama backend)
After=docker.service
Requires=docker.service

[Service]
ExecStart=docker compose -f ${COMPOSE_FILE} up ollama
ExecStop=docker compose -f ${COMPOSE_FILE} stop ollama
Restart=unless-stopped
User=${USER}

[Install]
WantedBy=multi-user.target
EOF
  sudo systemctl daemon-reload
  sudo systemctl enable llng-assistant
  sudo systemctl start llng-assistant
  success "Service installed and started"
fi

# ── Done ───────────────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}Installation complete.${NC}"
echo ""
echo "  Run:  llng-assistant"
echo ""
