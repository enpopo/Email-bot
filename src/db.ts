/**
 * db.ts — Prisma client instantiation using the pg driver adapter.
 * Prisma v7 requires the driver adapter pattern for all providers.
 */
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('Missing required environment variable: DATABASE_URL');

const adapter = new PrismaPg({ connectionString });

export const prisma = new PrismaClient({ adapter });
