import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"

function dto(service: any) {
  return {
    ...service,
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
  }
}

async function managed() {
  const session = await getSession()
  return session?.staffId && ["ADMIN", "PHARMACIST", "STAFF"].includes(session.role) ? session : null
}

function imageCreates(images: any[]) {
  return images.slice(0, 10).map((img: any, i: number) => ({
    url: String(img.url || img),
    storageKey: img.storageKey ? String(img.storageKey) : null,
    alt: img.alt ? String(img.alt) : null,
    sortOrder: i,
  }))
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const service = await db.service.findUnique({
    where: { id },
    include: {
      images: {
        orderBy: { sortOrder: "asc" },
      },
    },
  })

  if (!service) {
    return NextResponse.json({ error: "Service not found." }, { status: 404 })
  }

  if (!service.active && !(await managed())) {
    return NextResponse.json({ error: "Service not found." }, { status: 404 })
  }

  return NextResponse.json(dto(service))
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await managed())) {
    return NextResponse.json({ error: "Staff access required." }, { status: 403 })
  }

  const { id } = await ctx.params
  const body = await request.json()

  const existing = await db.service.findUnique({
    where: { id },
  })

  if (!existing) {
    return NextResponse.json({ error: "Service not found." }, { status: 404 })
  }

  const data: any = {}

  for (const key of ["name", "slug", "shortDescription", "description", "category", "priceLabel", "heroImage"]) {
    if (key in body) {
      data[key] = body[key] === "" ? null : body[key]
    }
  }

  if ("durationMinutes" in body) {
    data.durationMinutes = Math.max(1, Number(body.durationMinutes) || 15)
  }

  if ("price" in body) {
    data.price = body.price === null || body.price === "" ? null : Number(body.price)
  }

  for (const key of ["featured", "active"]) {
    if (key in body) {
      data[key] = Boolean(body[key])
    }
  }

  if ("sortOrder" in body) {
    data.sortOrder = Number(body.sortOrder) || 0
  }

  const service = await db.$transaction(async (tx) => {
    if (Array.isArray(body.images)) {
      await tx.serviceImage.deleteMany({
        where: { serviceId: id },
      })
    }

    return tx.service.update({
      where: { id },
      data: Array.isArray(body.images)
        ? {
            ...data,
            images: {
              create: imageCreates(body.images),
            },
          }
        : data,
      include: {
        images: {
          orderBy: { sortOrder: "asc" },
        },
      },
    })
  })

  return NextResponse.json(dto(service))
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await managed())) {
    return NextResponse.json({ error: "Staff access required." }, { status: 403 })
  }

  const { id } = await ctx.params

  const service = await db.service.findUnique({
    where: { id },
  })

  if (!service) {
    return NextResponse.json({ error: "Service not found." }, { status: 404 })
  }

  await db.service.update({
    where: { id },
    data: { active: false },
  })

  return NextResponse.json({ ok: true })
}
