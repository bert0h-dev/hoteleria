import 'dotenv/config';
import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '../src/generated/prisma/client.js';

// Datos iniciales: un hotel y un usuario administrador.
// Es idempotente: si el administrador ya existe, no hace nada.
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
});

async function main() {
  const email = process.env['SEED_ADMIN_EMAIL'];
  const password = process.env['SEED_ADMIN_PASSWORD'];
  if (!email || !password) {
    throw new Error('Faltan SEED_ADMIN_EMAIL o SEED_ADMIN_PASSWORD en .env');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`El administrador ${email} ya existe; no se hizo nada.`);
    return;
  }

  const hotel =
    (await prisma.hotel.findFirst()) ??
    (await prisma.hotel.create({
      data: { name: process.env['SEED_HOTEL_NAME'] ?? 'Mi Hotel' },
    }));

  await prisma.user.create({
    data: {
      hotelId: hotel.id,
      name: process.env['SEED_ADMIN_NAME'] ?? 'Administrador',
      email,
      passwordHash: await hash(password),
      role: Role.ADMIN,
    },
  });
  console.log(`Hotel "${hotel.name}" y administrador ${email} creados.`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
