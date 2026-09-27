#!/bin/sh
# Atualiza o Gestor Familiar quando o GitHub recebe uma nova versao.
# Executado por cron no host. Requer: git, docker e docker compose.
set -eu

APP_DIR="${APP_DIR:-/DATA/AppData/gestor-familiar}"
BRANCH="${BRANCH:-main}"
LOG_FILE="${LOG_FILE:-/var/log/gestor-familiar-autoupdate.log}"
LOCK_FILE="${LOCK_FILE:-/tmp/gestor-familiar-autoupdate.lock}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
KEEP_BACKUPS="${KEEP_BACKUPS:-10}"

# O ZimaOS monta /root somente para leitura; sem isto o docker aborta o build
# ao tentar criar $HOME/.docker. O cron tambem roda com um HOME minimo, entao o
# diretorio precisa vir de fora.
DOCKER_CONFIG="${DOCKER_CONFIG:-/DATA/Docker/.config-gestor}"
export DOCKER_CONFIG
mkdir -p "$DOCKER_CONFIG" 2>/dev/null || DOCKER_CONFIG=/tmp/.config-gestor
export DOCKER_CONFIG

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >>"$LOG_FILE"
}

die() {
  log "ERRO: $*"
  exit 1
}

# Evita execucoes simultaneas quando o build anterior ainda roda.
if ! mkdir "$LOCK_FILE" 2>/dev/null; then
  log "Outra atualizacao em andamento; nada a fazer."
  exit 0
fi
trap 'rmdir "$LOCK_FILE" 2>/dev/null || true' EXIT INT TERM

cd "$APP_DIR" || die "Diretorio $APP_DIR nao encontrado."

CURRENT="$(git rev-parse HEAD 2>/dev/null || true)"
[ -n "$CURRENT" ] || die "Nao e um repositorio git valido."

git fetch --quiet origin "$BRANCH" || die "Falha no git fetch de origin/$BRANCH."

REMOTE="$(git rev-parse "origin/$BRANCH" 2>/dev/null || true)"
[ -n "$REMOTE" ] || die "origin/$BRANCH nao encontrado."

if [ "$CURRENT" = "$REMOTE" ]; then
  log "Codigo inalterado em $CURRENT. Nada a fazer."
  exit 0
fi

log "Nova versao detectada: $CURRENT -> $REMOTE. Atualizando."

# .env e backups sao ignorados pelo git, portanto reset --hard nao os apaga.
git reset --hard "$REMOTE" || die "Falha ao mover o codigo para $REMOTE."
git clean -fdq -e backups || die "Falha ao limpar arquivos na rastreados."

cd "$APP_DIR" || die "Diretorio $APP_DIR nao encontrado apos o reset."

set -a
. ./.env
set +a

# Backup do banco antes de qualquer migracao, para permitir rollback.
# A limpeza e nada mais que higiene: nunca pode impedir a atualizacao.
prune_backups() {
  # O ZimaOS nao traz xargs, entao a contagem roda em shell puro.
  kept=0
  for dump in $(ls -1t "$BACKUP_DIR"/pre-update-*.dump 2>/dev/null); do
    kept=$((kept + 1))
    if [ "$kept" -gt "$KEEP_BACKUPS" ]; then
      rm -f "$dump"
    fi
  done
}

mkdir -p "$BACKUP_DIR"
STAMP="$(date '+%Y%m%d-%H%M%S')"
if docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-familia_app}" "${POSTGRES_DB:-familia}" 2>/dev/null | gzip >"$BACKUP_DIR/pre-update-$STAMP.dump"; then
  log "Backup salvo em backups/pre-update-$STAMP.dump"
  prune_backups || log "AVISO: nao foi possivel limpar backups antigos."
else
  log "AVISO: backup do banco falhou; seguindo com a atualizacao."
  rm -f "$BACKUP_DIR/pre-update-$STAMP.dump"
fi

if docker compose up -d --build --remove-orphans; then
  log "Atualizacao concluida em $REMOTE."
else
  log "ERRO: docker compose up falhou. O codigo esta em $REMOTE."
  docker compose logs --tail=50 app migrate >>"$LOG_FILE" 2>&1 || true
  exit 1
fi

docker image prune -f --filter "until=168h" >/dev/null 2>&1 || true
log "Imagens antigas removidas."
