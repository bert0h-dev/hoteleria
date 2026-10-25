import 'dotenv/config';
import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  Amenity,
  PrismaClient,
  Role,
  RoomStatus,
} from '../src/generated/prisma/client.js';

// Datos iniciales. Es idempotente: cada bloque solo se crea si falta.
// - Hotel y usuario administrador.
// - Configuración de tarifas con los valores por defecto.
// - Catálogo de ejemplo (3 tipos y 10 habitaciones) si no hay tipos.
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
});

const ROOM_TYPES = [
  {
    name: 'Sencilla',
    description: 'Habitación con cama matrimonial, ideal para 1 o 2 personas.',
    maxAdults: 2,
    maxChildren: 0,
    nightlyRate: 850,
    amenities: [Amenity.WIFI, Amenity.AIR_CONDITIONING, Amenity.TV],
  },
  {
    name: 'Doble',
    description: 'Dos camas matrimoniales, perfecta para familias.',
    maxAdults: 4,
    maxChildren: 2,
    nightlyRate: 1200,
    amenities: [
      Amenity.WIFI,
      Amenity.AIR_CONDITIONING,
      Amenity.TV,
      Amenity.MINIBAR,
      Amenity.SAFE,
    ],
  },
  {
    name: 'Suite',
    description: 'Cama king size, sala de estar, jacuzzi y vista al mar.',
    maxAdults: 2,
    maxChildren: 2,
    nightlyRate: 2500,
    amenities: [
      Amenity.WIFI,
      Amenity.AIR_CONDITIONING,
      Amenity.TV,
      Amenity.MINIBAR,
      Amenity.JACUZZI,
      Amenity.SEA_VIEW,
      Amenity.BALCONY,
      Amenity.COFFEE_MAKER,
    ],
  },
];

// número, piso, tipo, estado inicial
const ROOMS: [string, number, string, RoomStatus][] = [
  ['101', 1, 'Sencilla', RoomStatus.AVAILABLE],
  ['102', 1, 'Sencilla', RoomStatus.AVAILABLE],
  ['103', 1, 'Doble', RoomStatus.CLEANING],
  ['104', 1, 'Doble', RoomStatus.AVAILABLE],
  ['105', 1, 'Doble', RoomStatus.MAINTENANCE],
  ['201', 2, 'Sencilla', RoomStatus.AVAILABLE],
  ['202', 2, 'Doble', RoomStatus.AVAILABLE],
  ['203', 2, 'Doble', RoomStatus.CLEANING],
  ['204', 2, 'Suite', RoomStatus.AVAILABLE],
  ['205', 2, 'Suite', RoomStatus.AVAILABLE],
];

async function seedAdmin() {
  const email = process.env['SEED_ADMIN_EMAIL'];
  const password = process.env['SEED_ADMIN_PASSWORD'];
  if (!email || !password) {
    throw new Error('Faltan SEED_ADMIN_EMAIL o SEED_ADMIN_PASSWORD en .env');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`• El administrador ${email} ya existe.`);
    return existing.hotelId;
  }

  const hotel =
    (await prisma.hotel.findFirst({ orderBy: { createdAt: 'asc' } })) ??
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
  console.log(`✓ Hotel "${hotel.name}" y administrador ${email} creados.`);
  return hotel.id;
}

async function seedSettings(hotelId: string) {
  await prisma.hotelSettings.upsert({
    where: { hotelId },
    create: { hotelId },
    update: {},
  });
  console.log('✓ Configuración de tarifas lista.');
}

async function seedCatalog(hotelId: string) {
  if (await prisma.roomType.count({ where: { hotelId } })) {
    console.log('• El catálogo de habitaciones ya existe.');
    return;
  }
  const typeIds = new Map<string, string>();
  for (const type of ROOM_TYPES) {
    const created = await prisma.roomType.create({
      data: { ...type, hotelId },
    });
    typeIds.set(type.name, created.id);
  }
  await prisma.room.createMany({
    data: ROOMS.map(([number, floor, type, status]) => ({
      hotelId,
      number,
      floor,
      status,
      roomTypeId: typeIds.get(type)!,
    })),
  });
  console.log(
    `✓ Catálogo de ejemplo: ${ROOM_TYPES.length} tipos y ${ROOMS.length} habitaciones.`,
  );
}

try {
  const hotelId = await seedAdmin();
  await seedSettings(hotelId);
  await seedCatalog(hotelId);
} finally {
  await prisma.$disconnect();
}
