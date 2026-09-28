import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

const db = new PrismaClient();
try {
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) throw new Error('AUTH_SECRET deve ter pelo menos 32 caracteres aleatórios.');
  await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(713024)`;
    const adminUsername = (process.env.INITIAL_ADMIN_USERNAME || 'admin').trim().toLowerCase();
    const existingAdmin = await tx.user.findUnique({ where: { username: adminUsername } });
    if (existingAdmin) {
      console.log('Administrador já existe; mantendo credenciais.');
      return;
    }
    // Remove usuário de teste se existir (ambiente de testes)
    await tx.user.deleteMany({ where: { username: 'test' } });
    const password = process.env.INITIAL_ADMIN_PASSWORD || '';
    if (!/^[a-z0-9._-]{3,40}$/.test(adminUsername)) throw new Error('Nome de administrador inválido.');
    if (password.length < 4 || password.length > 128) throw new Error('INITIAL_ADMIN_PASSWORD deve ter de 4 a 128 caracteres.');
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    await tx.user.create({ data: { username: adminUsername, name: 'Administrador', admin: true, passwordHash: `${salt}:${hash}` } });
    console.log('Administrador inicial criado. Troque a senha no primeiro acesso.');
  });
} finally { await db.$disconnect(); }
