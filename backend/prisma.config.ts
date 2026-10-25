import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// La CLI de Prisma (migraciones) usa la conexión directa de Neon;
// la aplicación usa DATABASE_URL (pooler) desde PrismaService.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'],
  },
});
