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

# O .env define TZ e o host pode estar em outro fuso. Como o log e escrito com
# date, fixar o fuso aqui e o que mantem a primeira e a ultima linha do mesmo
# registro de acordo; caso contrario a linha posterior a leitura do .env sai
# com um fuso e as anteriores com outro.
if [ -z "${TZ:-}" ] && [ -f "$APP_DIR/.env" ]; then
  TZ="$(sed -n 's/^TZ=//p' "$APP_DIR/.env" 2>/dev/null | head -1)"
  if [ -n "$TZ" ]; then
    export TZ
  fi
fi

# O ZimaOS monta /root somente para leitura; sem isto o docker aborta o build
# ao tentar criar $HOME/.docker. O cron tambem roda com um HOME minimo, entao o
# diretorio precisa vir de fora.
DOCKER_CONFIG="${DOCKER_CONFIG:-/DATA/Docker/.config-gestor}"
export DOCKER_CONFIG
mkdir -p "$DOCKER_CONFIG" 2>/dev/null || DOCKER_CONFIG=/tmp/.config-gestor
export DOCKER_CONFIG

SELF_PATH="${GF_SELF_PATH:-$0}"
# 0 = ainda nao trouxemos nada do GitHub; 1 = codigo ja movido para origin/$BRANCH.
RESUMED="${GF_RESUMED:-0}"

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >>"$LOG_FILE"
}

die() {
  log "ERRO: $*"
  exit 1
}

release_lock() {
  rm -rf "$LOCK_FILE" 2>/dev/null || true
}

# O exec abaixo preserva o PID, entao o dono da trava continua sendo este mesmo
# processo e a etapa reanudada pode continuar usando a mesma trava.
acquire_lock() {
  if mkdir "$LOCK_FILE" 2>/dev/null; then
    echo $$ >"$LOCK_FILE/pid"
    return 0
  fi
  # Trava de uma execucao anterior que morreu no meio do caminho.
  owner="$(cat "$LOCK_FILE/pid" 2>/dev/null || true)"
  if [ -n "$owner" ] && ! kill -0 "$owner" 2>/dev/null; then
    release_lock
    if mkdir "$LOCK_FILE" 2>/dev/null; then
      echo $$ >"$LOCK_FILE/pid"
      return 0
    fi
  fi
  return 1
}

# ---------------------------------------------------------------- etapa 1
# Buscar o codigo novo e realinhar o repositorio.
if [ "$RESUMED" = "0" ]; then
  if ! acquire_lock; then
    log "Outra atualizacao em andamento; nada a fazer."
    exit 0
  fi

  cd "$APP_DIR" || die "Diretorio $APP_DIR nao encontrado."

  CURRENT="$(git rev-parse HEAD 2>/dev/null || true)"
  [ -n "$CURRENT" ] || die "Nao e um repositorio git valido."

  git fetch --quiet origin "$BRANCH" || die "Falha no git fetch de origin/$BRANCH."

  REMOTE="$(git rev-parse "origin/$BRANCH" 2>/dev/null || true)"
  [ -n "$REMOTE" ] || die "origin/$BRANCH nao encontrado."

  if [ "$CURRENT" = "$REMOTE" ]; then
    log "Codigo inalterado em $CURRENT. Nada a fazer."
    release_lock
    exit 0
  fi

  log "Nova versao detectada: $CURRENT -> $REMOTE. Atualizando."

  # .env e backups sao ignorados pelo git, portanto reset --hard nao os apaga.
  git reset --hard "$REMOTE" || die "Falha ao mover o codigo para $REMOTE."
  git clean -fdq -e backups || die "Falha ao limpar arquivos nao rastreados."

  # Este reset acabou de substituir o arquivo que estamos executando. O shell
  # continuaria lendo o inode antigo ate o fim, ou seja, a versao nova jamais
  # entraria em vigor. Reexecutamos para que o restante rode o codigo novo.
  GF_RESUMED=1
  GF_SELF_PATH="$SELF_PATH"
  export GF_RESUMED GF_SELF_PATH
  exec sh "$SELF_PATH"
fi

# ---------------------------------------------------------------- etapa 2
# Backup, reconstrucao e subida. Roda sempre a versao recem-baixada.
trap 'release_lock' EXIT INT TERM

cd "$APP_DIR" || die "Diretorio $APP_DIR nao encontrado."
REMOTE="$(git rev-parse HEAD)"

# O ZimaOS nao traz xargs, entao a contagem e feita em shell puro. Esta etapa e
# apenas higiene e nunca pode impedir a atualizacao.
prune_backups() {
  kept=0
  for dump in $(ls -1t "$BACKUP_DIR"/pre-update-*.dump 2>/dev/null); do
    kept=$((kept + 1))
    if [ "$kept" -gt "$KEEP_BACKUPS" ]; then
      rm -f "$dump"
    fi
  done
}

set -a
. ./.env
set +a

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
