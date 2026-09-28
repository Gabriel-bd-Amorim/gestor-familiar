import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

const db = new PrismaClient();
try {
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) throw new Error('AUTH_SECRET deve ter pelo menos 32 caracteres aleatórios.');
  await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(713024)`;
    if (await tx.user.count()) {
      console.log('Banco já inicializado; credenciais existentes preservadas.');
      return;
    }
    const username = (process.env.INITIAL_ADMIN_USERNAME || 'admin').trim().toLowerCase();
    const password = process.env.INITIAL_ADMIN_PASSWORD || '';
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) throw new Error('Nome de administrador inválido.');
    if (password.length < 6 || password.length > 128) throw new Error('INITIAL_ADMIN_PASSWORD deve ter de 6 a 128 caracteres.');
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    await tx.user.create({ data: { username, name: 'Administrador', admin: true, passwordHash: `${salt}:${hash}` } });
    console.log('Administrador inicial criado. Troque a senha no primeiro acesso.');
  });
} finally { await db.$disconnect(); }
