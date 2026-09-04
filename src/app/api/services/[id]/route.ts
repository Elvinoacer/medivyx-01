import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { managedImage, validateServiceFields } from "@/lib/security/service"

function dto(service: any) {
  return {
    ...service,
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
  }
}

async function managed() {
  const session = await getSession()
  return session?.staffId && session.staffRole && ["ADMIN", "PHARMACIST", "STAFF"].includes(session.staffRole) ? session : null
}

function imageCreates(images: any[]) {
  return images.slice(0, 10).map((img: any, i: number) => ({
    url: managedImage(img.url || img)!,
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
  if (Array.isArray(body.images) && (body.images.length > 10 || body.images.some((image: any) => !managedImage(image?.url || image)))) return NextResponse.json({ error: "Every service image must be an owned upload or site image." }, { status: 400 })

  const existing = await db.service.findUnique({
    where: { id },
  })

  if (!existing) {
    return NextResponse.json({ error: "Service not found." }, { status: 404 })
  }

  const validated = validateServiceFields(body, true)
  if (validated.error) return NextResponse.json({ error: validated.error }, { status: 400 })
  const data: any = validated.data

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
