import { PrismaClient } from '@prisma/client';

// Yagona (singleton) Prisma mijozi — Next.js dev hot-reload va
// route/page'lar uchun bitta ulanish hovuzi. Ko'p `new PrismaClient()`
// o'rniga shuni import qiling: ulanishlar kamayadi, "too many
// connections" / "connection reset" loglari oldini oladi.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
