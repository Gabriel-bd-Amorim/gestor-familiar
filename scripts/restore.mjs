import { openSync, closeSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const file = process.argv[2];
if (!file || !file.endsWith('.dump')) throw new Error('Uso: npm run restore -- backups/arquivo.dump. A restauração substitui os dados atuais.');
const fd = openSync(file, 'r');
function docker(args, input = 'inherit') {
  const result = spawnSync('docker', ['compose', ...args], { stdio: [input, 'inherit', 'inherit'] });
  if (result.error || result.status !== 0) throw result.error || new Error('Operação interrompida. Consulte a saída acima; a aplicação pode estar parada.');
}
try {
  docker(['stop', 'app']);
  docker(['exec', '-T', 'postgres', 'sh', '-c', 'pg_restore --clean --if-exists --no-owner --exit-on-error --single-transaction -U "$POSTGRES_USER" -d "$POSTGRES_DB"'], fd);
} finally { closeSync(fd); }
docker(['run', '--rm', 'migrate']);
docker(['exec', '-T', 'postgres', 'sh', '-c', 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \'DELETE FROM "Session";\'']);
docker(['up', '-d', 'app']);
console.log('Restauração concluída. As sessões foram invalidadas; entre novamente.');
