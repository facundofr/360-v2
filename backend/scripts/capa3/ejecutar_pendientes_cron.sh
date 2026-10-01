#!/usr/bin/env bash
# Wrapper de cron para Capa 3: procesa únicamente los mensajes pendientes de
# features_mensaje. No regenera el playbook, no toca tablas operativas.
#
# Uso manual: backend/scripts/capa3/ejecutar_pendientes_cron.sh
# Uso en cron: ver backend/scripts/capa3/crontab_capa3.txt

set -uo pipefail

# Directorio real del backend (resuelto en base a la ubicación de este script,
# no hardcodeado, para que funcione sin importar desde dónde se invoque).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$BACKEND_DIR" || { echo "No se pudo entrar a $BACKEND_DIR"; exit 1; }

LOG_DIR="$BACKEND_DIR/logs/capa3"
mkdir -p "$LOG_DIR"
FECHA="$(date +%Y-%m-%d_%H-%M-%S)"
LOG_FILE="$LOG_DIR/capa3_$FECHA.log"

LOCK_FILE="/tmp/cober360_capa3_self.lock"

# Concurrencia configurable (default 5 para la corrida nocturna del cron).
export CAPA3_CONCURRENCY="${CAPA3_CONCURRENCY:-5}"

# Auto-lock interno (además del flock que envuelve este script desde crontab):
# protege también ejecuciones manuales concurrentes.
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
  echo "$(date -Iseconds) — ya hay una ejecución de Capa 3 en curso, se aborta esta corrida." >> "$LOG_FILE"
  exit 75 # EX_TEMPFAIL
fi

{
  echo "===================================================================="
  echo "Capa 3 — inicio de corrida: $(date -Iseconds)"
  echo "Directorio: $BACKEND_DIR"
  echo "Concurrencia: $CAPA3_CONCURRENCY"
  echo "===================================================================="
} >> "$LOG_FILE"

# node ya carga backend/.env internamente (dotenv) en cada script de Capa 3;
# no se parsea ni se imprime el contenido de .env acá, así no hay riesgo de
# filtrar secretos en el log.
node scripts/capa3/procesar_historico.js --concurrencia "$CAPA3_CONCURRENCY" >> "$LOG_FILE" 2>&1
EXIT_CODE=$?

{
  echo "Capa 3 — fin de corrida: $(date -Iseconds) — exit_code=$EXIT_CODE"
  echo "===================================================================="
} >> "$LOG_FILE"

# Rotación simple: conservar solo los últimos 60 archivos de log de Capa 3
# (complementario al logrotate.d instalado a nivel de sistema).
ls -1t "$LOG_DIR"/capa3_*.log 2>/dev/null | tail -n +61 | xargs -r rm -f

exit $EXIT_CODE
