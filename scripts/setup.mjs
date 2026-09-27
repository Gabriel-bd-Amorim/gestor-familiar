import { randomBytes } from 'node:crypto';
import { writeFileSync, existsSync } from 'node:fs';

if (existsSync('.env')) {
  console.log('.env já existe. Nenhum valor foi alterado.');
} else {
  const dbPassword = randomBytes(24).toString('hex');
  const authSecret = randomBytes(32).toString('hex');
  const adminPassword = randomBytes(18).toString('base64url');
  writeFileSync('.env', `POSTGRES_DB=familia\nPOSTGRES_USER=familia_app\nPOSTGRES_PASSWORD=${dbPassword}\nDATABASE_URL=postgresql://familia_app:${dbPassword}@postgres:5432/familia?schema=public\nAUTH_SECRET=${authSecret}\nINITIAL_ADMIN_USERNAME=admin\nINITIAL_ADMIN_PASSWORD=${adminPassword}\nAPP_URL=http://localhost:3000\nAPP_PORT=3000\nAPP_BIND=127.0.0.1\nTZ=America/Sao_Paulo\nOPENAI_API_KEY=\nOPENAI_MODEL=gpt-4.1-mini\n`, { flag: 'wx', mode: 0o600 });
  console.log('.env criado com segredos aleatórios. Consulte INITIAL_ADMIN_PASSWORD nesse arquivo para o primeiro acesso. Configure APP_URL antes de publicar.');
}
