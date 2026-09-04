/** Minimal development seed. Never creates customer, order, prescription, or clinical-history data. */
import { PrismaClient } from "@prisma/client"
import { hashPassword } from "../src/lib/hash"

const db = new PrismaClient()

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.ALLOW_DESTRUCTIVE_SEED !== "true") {
    throw new Error("Destructive seed refused. Set ALLOW_DESTRUCTIVE_SEED=true only for an approved non-production database.")
  }
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error("DATABASE_URL is required")
  const databaseHost = new URL(databaseUrl).hostname
  const localDatabase = ["localhost", "127.0.0.1", "::1"].includes(databaseHost)
  if (!localDatabase && process.env.SEED_DATABASE_ACK !== databaseHost) {
    throw new Error(`Refusing to seed ${databaseHost}. Set SEED_DATABASE_ACK to that host only for an approved non-production database.`)
  }

  const categories = [
    ["Prescription Medicines", "prescription"],
    ["OTC Medicines", "otc"],
    ["Pain & Fever", "pain-fever"],
    ["Cold & Flu", "cold-flu"],
    ["Vitamins & Supplements", "vitamins"],
    ["Personal Care", "personal-care"],
    ["Medical Devices", "medical-devices"],
  ] as const
  for (const [name, slug] of categories) {
    await db.category.upsert({ where: { slug }, create: { name, slug }, update: { name } })
  }

  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.SEED_ADMIN_PASSWORD
  if (email || password) {
    if (!email || !password || password.length < 14) throw new Error("SEED_ADMIN_EMAIL and a 14+ character SEED_ADMIN_PASSWORD must be provided together.")
    await db.staffUser.upsert({
      where: { email },
      create: { name: "Development Administrator", email, passwordHash: await hashPassword(password), role: "ADMIN", title: "Administrator" },
      update: { passwordHash: await hashPassword(password), role: "ADMIN", active: true, authVersion: { increment: 1 } },
    })
    await db.session.deleteMany({ where: { staff: { email } } })
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : "Seed failed")
    await db.$disconnect()
    process.exit(1)
  })
