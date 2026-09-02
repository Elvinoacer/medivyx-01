import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const databaseUrl =
  process.env.DATABASE_URL ??
  process.env.sphere_pharmacy_PRISMA_DATABASE_URL ??
  process.env.sphere_pharmacy_DATABASE_URL ??
  process.env.sphere_pharmacy_POSTGRES_URL

if (!databaseUrl) {
  throw new Error(
    "Database configuration missing. Set DATABASE_URL, sphere_pharmacy_PRISMA_DATABASE_URL, sphere_pharmacy_DATABASE_URL, or sphere_pharmacy_POSTGRES_URL."
  )
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: databaseUrl,
    log: ["warn", "error"],
  })

globalForPrisma.prisma = db
