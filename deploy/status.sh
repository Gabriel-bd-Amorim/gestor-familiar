#!/bin/sh
# Mostra o estado da implantacao do Gestor Familiar.
# Uso:  sh deploy/status.sh   (ou a partir do cron, com LOG_FILE definido)
set -eu

APP_DIR="${APP_DIR:-/DATA/AppData/gestor-familiar}"
BRANCH="${BRANCH:-main}"
LOG_FILE="${LOG_FILE:-/var/log/gestor-familiar-autoupdate.log}"

DOCKER_CONFIG="${DOCKER_CONFIG:-/DATA/Docker/.config-gestor}"
export DOCKER_CONFIG
mkdir -p "$DOCKER_CONFIG" 2>/dev/null || DOCKER_CONFIG=/tmp/.config-gestor
export DOCKER_CONFIG

cd "$APP_DIR" 2>/dev/null || {
  printf 'Diretorio %s nao encontrado.\n' "$APP_DIR"
  exit 1
}

LOCAL="$(git rev-parse --short HEAD 2>/dev/null || echo 'desconhecido')"
REMOTE="$(git ls-remote origin "refs/heads/$BRANCH" 2>/dev/null | cut -c1-7 || echo 'indisponivel')"

printf 'servidor   %s\n' "$LOCAL"
printf 'github     %s\n' "$REMOTE"
if [ "$LOCAL" = "$REMOTE" ]; then
  printf 'situacao   em dia\n\n'
else
  printf 'situacao   ATRASADO, o proximo ciclo do cron atualiza\n\n'
fi

APP_URL="$(sed -n 's/^APP_URL=//p' .env 2>/dev/null | head -1)"
printf 'url        %s\n' "${APP_URL:-desconhecida}"

if command -v curl >/dev/null 2>&1 && [ -n "$APP_URL" ]; then
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$APP_URL/api/health" 2>/dev/null || echo 000)"
  printf 'saude      HTTP %s em /api/health\n' "$code"
fi

printf '\ncontainers\n'
docker compose ps --format 'table {{.Name}}\t{{.Status}}\t{{.Ports}}' 2>&1 | sed 's/^/  /'

printf '\nbackups em %s/backups\n' "$APP_DIR"
if [ -d backups ]; then
  count="$(ls -1 backups/pre-update-*.dump 2>/dev/null | wc -l | tr -d ' ')"
  printf '  %s dump(s) de pre-atualizacao\n' "$count"
  ls -1t backups/pre-update-*.dump 2>/dev/null | head -3 | sed 's/^/  /'
else
  printf '  nenhum\n'
fi

printf '\nultimas atualizacoes\n'
if [ -f "$LOG_FILE" ]; then
  tail -n 5 "$LOG_FILE" | sed 's/^/  /'
else
  printf '  log ainda nao criado (%s)\n' "$LOG_FILE"
fi
