import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { toCategoryDTO } from "@/lib/dto"

export async function GET() {
  const categories = await db.category.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { products: { where: { active: true } } } } },
  })
  return NextResponse.json(categories.map((c) => toCategoryDTO(c, c._count.products)))
}
