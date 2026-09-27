#!/bin/sh
# Instala o Gestor Familiar no host (ZimaOS/CasaOS) e ativa a atualizacao automatica.
# Uso:  sh deploy/install.sh
# Requer: git, docker com compose v2, openssl.
set -eu

REPO_URL="${REPO_URL:-https://github.com/Gabriel-bd-Amorim/gestor-familiar}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/DATA/AppData/gestor-familiar}"
APP_PORT="${APP_PORT:-3210}"
APP_BIND="${APP_BIND:-0.0.0.0}"
APP_URL="${APP_URL:-}"
TZ_NAME="${TZ_NAME:-America/Sao_Paulo}"
CRON_SCHEDULE="${CRON_SCHEDULE:-*/10 * * * *}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"

log() { printf '[instalador] %s\n' "$*"; }
die() { printf '[instalador] ERRO: %s\n' "$*" >&2; exit 1; }

command -v git >/dev/null 2>&1 || die "git nao encontrado."
command -v docker >/dev/null 2>&1 || die "docker nao encontrado."
docker compose version >/dev/null 2>&1 || die "docker compose v2 nao encontrado."

if [ -z "$APP_URL" ]; then
  HOST_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
  [ -n "$HOST_IP" ] || HOST_IP="127.0.0.1"
  APP_URL="http://$HOST_IP:$APP_PORT"
fi

mkdir -p "$(dirname "$APP_DIR")"

if [ -d "$APP_DIR/.git" ]; then
  log "Repositorio existente em $APP_DIR. Atualizando."
  git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
else
  log "Clonando $REPO_URL em $APP_DIR."
  [ -e "$APP_DIR" ] && die "$APP_DIR ja existe e nao e um repositorio git."
  git clone --quiet --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
chmod +x scripts/auto-update.sh

if [ -f .env ]; then
  log ".env existente preservado."
else
  log "Gerando .env com segredos aleatorios."
  POSTGRES_PASSWORD="$(openssl rand -hex 24)"
  AUTH_SECRET="$(openssl rand -hex 32)"
  if [ -n "${INITIAL_ADMIN_PASSWORD:-}" ]; then
    ADMIN_PASSWORD="$INITIAL_ADMIN_PASSWORD"
  else
    ADMIN_PASSWORD="$(openssl rand -base64 12 | tr -d '/+=' | cut -c1-16)"
  fi

  umask 077
  cat >.env <<EOF
POSTGRES_DB=familia
POSTGRES_USER=familia_app
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
DATABASE_URL=postgresql://familia_app:$POSTGRES_PASSWORD@postgres:5432/familia?schema=public
AUTH_SECRET=$AUTH_SECRET
INITIAL_ADMIN_USERNAME=$ADMIN_USERNAME
INITIAL_ADMIN_PASSWORD=$ADMIN_PASSWORD
APP_URL=$APP_URL
APP_PORT=$APP_PORT
APP_BIND=$APP_BIND
TZ=$TZ_NAME
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
EOF
  chmod 600 .env
  umask 022

  printf '\n%s\n%s\n%s\n%s\n\n' \
    "====================================================" \
    "  Credenciais iniciais do Gestor Familiar" \
    "====================================================" \
    "  URL:      $APP_URL" >install-credentials.txt
  printf '  Usuario:  %s\n  Senha:    %s\n\n' "$ADMIN_USERNAME" "$ADMIN_PASSWORD" >>install-credentials.txt
  printf '  Arquivo:  %s/install-credentials.txt\n' "$APP_DIR" >>install-credentials.txt
  printf '  Senha do postgres: %s\n\n' "$POSTGRES_PASSWORD" >>install-credentials.txt
  chmod 600 install-credentials.txt

  log "Usuario: $ADMIN_USERNAME"
  log "Senha inicial: $ADMIN_PASSWORD"
fi

log "Subindo os containers (build pode levar alguns minutos)."
docker compose up -d --build

log "Registrando atualizacao automatica no cron: $CRON_SCHEDULE"
CRON_LINE="$CRON_SCHEDULE APP_DIR=$APP_DIR BRANCH=$BRANCH LOG_FILE=/var/log/gestor-familiar-autoupdate.log sh $APP_DIR/scripts/auto-update.sh >/dev/null 2>&1"
( crontab -l 2>/dev/null | grep -vF 'scripts/auto-update.sh' || true; echo "$CRON_LINE" ) | crontab -

log "Servico disponivel em $APP_URL"
log "Para acompanhar:  docker compose -f $APP_DIR/compose.yaml logs -f app"
log "Log de atualizacoes:  tail -f /var/log/gestor-familiar-autoupdate.log"
