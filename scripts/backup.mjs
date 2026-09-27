import { mkdirSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

mkdirSync('backups', { recursive: true, mode: 0o700 });
const file = join('backups', `entrecontas-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`);
const fd = openSync(file, 'wx', 0o600);
let result;
try {
  result = spawnSync('docker', ['compose', 'exec', '-T', 'postgres', 'sh', '-c', 'pg_dump -Fc --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"'], { stdio: ['ignore', fd, 'inherit'] });
} finally { closeSync(fd); }
if (result.error || result.status !== 0) {
  unlinkSync(file);
  throw result.error || new Error('Backup não concluído. Confira se o PostgreSQL está em execução.');
}
console.log(`Backup criado: ${file}. Copie-o para um local separado e protegido.`);
