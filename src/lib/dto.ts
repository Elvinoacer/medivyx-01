import { db } from "@/lib/db"
import type {
  AddressDTO,
  AuditLogDTO,
  CategoryDTO,
  NotificationDTO,
  OrderDTO,
  OrderItemDTO,
  PaymentDTO,
  PrescriptionDTO,
  ProductDTO,
  PromotionDTO,
  ReviewDTO,
} from "@/lib/types"
import type { OrderStatus, PaymentStatus, PaymentProvider, RxStatus, StockStatus, OrderType, Fulfillment, Role } from "@/lib/constants"

type DbProduct = {
  id: string; name: string; sku: string; brand: string | null; packSize: string | null;
  price: number; compareAtPrice: number | null; stockStatus: string; stockQty: number;
  requiresPrescription: boolean; description: string; usageInfo: string | null;
  warnings: string | null; image: string | null; images?: string[]; categoryId: string | null;
  categoryName?: string | null; categorySlug?: string | null;
  category?: { name: string; slug: string } | null;
  avgRating?: number | null; reviewCount?: number;
}

export function toProductDTO(p: DbProduct): ProductDTO {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    brand: p.brand,
    packSize: p.packSize,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    stockStatus: p.stockStatus as StockStatus,
    stockQty: p.stockQty,
    requiresPrescription: p.requiresPrescription,
    description: p.description,
    usageInfo: p.usageInfo,
    warnings: p.warnings,
    image: p.image,
    images: p.images ?? [],
    categoryId: p.categoryId,
    categoryName: p.category?.name ?? p.categoryName ?? null,
    categorySlug: p.category?.slug ?? p.categorySlug ?? null,
    avgRating: p.avgRating ?? null,
    reviewCount: p.reviewCount ?? 0,
  }
}

export function toCategoryDTO(c: { id: string; name: string; slug: string; description: string | null; icon: string | null }, productCount: number): CategoryDTO {
  return { id: c.id, name: c.name, slug: c.slug, description: c.description, icon: c.icon, productCount }
}

type DbOrderItem = {
  id: string; productId: string | null; name: string; price: number; qty: number;
  requiresPrescription: boolean; lineTotal: number;
}

function toOrderItemDTO(i: DbOrderItem): OrderItemDTO {
  return {
    id: i.id, productId: i.productId, name: i.name, price: i.price, qty: i.qty,
    requiresPrescription: i.requiresPrescription, lineTotal: i.lineTotal,
  }
}

type DbPayment = {
  id: string; provider: string; method: string | null; status: string; amount: number;
  phone: string | null; cardLast4: string | null; providerReference: string | null;
  failureReason: string | null; createdAt: Date;
}

export function toPaymentDTO(p: DbPayment): PaymentDTO {
  return {
    id: p.id, provider: p.provider as PaymentProvider, method: p.method, status: p.status as PaymentStatus,
    amount: p.amount, phone: p.phone, cardLast4: p.cardLast4, providerReference: p.providerReference,
    failureReason: p.failureReason, createdAt: p.createdAt.toISOString(),
  }
}

type DbPrescription = {
  id: string; fileName: string; fileType: string; notes: string | null; status: string;
  reviewNotes: string | null; reviewedById: string | null; reviewedBy?: { name: string } | null;
  refillsAllowed: number; refillsUsed: number; validUntil: Date | null; createdAt: Date;
  orderId: string | null; order?: { reference: string } | null;
  user?: { name: string | null; phone: string | null } | null; userId: string | null;
  fileUrl?: string | null; storageKey?: string | null;
}

export function toPrescriptionDTO(rx: DbPrescription, includeCustomer = false): PrescriptionDTO {
  return {
    id: rx.id,
    fileName: rx.fileName,
    fileType: rx.fileType,
    notes: rx.notes,
    status: rx.status as RxStatus,
    reviewNotes: rx.reviewNotes,
    reviewedByName: rx.reviewedBy?.name ?? null,
    reviewedAt: null, // filled by caller when raw row has it
    refillsAllowed: rx.refillsAllowed,
    refillsUsed: rx.refillsUsed,
    validUntil: rx.validUntil ? rx.validUntil.toISOString() : null,
    createdAt: rx.createdAt.toISOString(),
    orderId: rx.orderId,
    orderReference: rx.order?.reference ?? null,
    fileUrl: rx.fileUrl ?? null,
    storageKey: rx.storageKey ?? null,
    ...(includeCustomer
      ? { customerName: rx.user?.name ?? null, customerPhone: rx.user?.phone ?? null }
      : {}),
  }
}

/** Full order with relations → DTO. */
export function toOrderDTO(order: {
  id: string; reference: string; type: string; status: string; fulfillment: string;
  deliveryAddress: string | null; deliveryArea: string | null; deliveryNotes: string | null;
  deliveryFee: number; subtotal: number; total: number; notes: string | null; pickupCode: string | null;
  riderId?: string | null; riderName: string | null; createdAt: Date; updatedAt: Date;
  pointsEarned?: number | null; pointsRedeemed?: number | null;
  discountAmount?: number | null; promotionCode?: string | null;
  guestName?: string | null; guestPhone?: string | null;
  user?: { name: string | null; phone: string | null } | null;
  items: DbOrderItem[];
  statusHistory: { id: string; status: string; note: string | null; actor: string; createdAt: Date }[];
  payments: DbPayment[];
  prescriptions: DbPrescription[];
}): OrderDTO {
  return {
    id: order.id,
    reference: order.reference,
    type: order.type as OrderType,
    status: order.status as OrderStatus,
    fulfillment: order.fulfillment as Fulfillment,
    deliveryAddress: order.deliveryAddress,
    deliveryArea: order.deliveryArea,
    deliveryNotes: order.deliveryNotes,
    deliveryFee: order.deliveryFee,
    subtotal: order.subtotal,
    discountAmount: order.discountAmount ?? 0,
    promotionCode: order.promotionCode ?? null,
    total: order.total,
    notes: order.notes,
    pickupCode: order.pickupCode,
    pointsEarned: order.pointsEarned ?? 0,
    pointsRedeemed: order.pointsRedeemed ?? 0,
    riderId: order.riderId ?? null,
    riderName: order.riderName,
    customerName: order.user?.name ?? order.guestName ?? null,
    customerPhone: order.user?.phone ?? order.guestPhone ?? null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    items: order.items.map(toOrderItemDTO),
    statusHistory: order.statusHistory
      .slice()
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((h) => ({
        id: h.id, status: h.status as OrderStatus, note: h.note, actor: h.actor, createdAt: h.createdAt.toISOString(),
      })),
    payments: order.payments.map(toPaymentDTO),
    prescriptions: order.prescriptions.map((rx) => ({
      ...toPrescriptionDTO(rx),
      reviewedAt: null,
    })),
  }
}

export function toAddressDTO(a: { id: string; label: string; text: string; area: string | null; notes: string | null; isDefault: boolean }): AddressDTO {
  return { id: a.id, label: a.label, text: a.text, area: a.area, notes: a.notes, isDefault: a.isDefault }
}

export function toPromotionDTO(p: {
  id: string; title: string; description: string; badge: string | null; code: string | null;
  discountPct: number | null; color: string | null; active: boolean;
  startsAt: Date | null; endsAt: Date | null;
}): PromotionDTO {
  return {
    id: p.id, title: p.title, description: p.description, badge: p.badge, code: p.code,
    discountPct: p.discountPct, color: p.color, active: p.active,
    startsAt: p.startsAt ? p.startsAt.toISOString() : null,
    endsAt: p.endsAt ? p.endsAt.toISOString() : null,
  }
}

export function toNotificationDTO(n: {
  id: string; channel: string; event: string | null; title: string; message: string;
  read: boolean; createdAt: Date; metadata?: string | null; staffId?: string | null;
}): NotificationDTO {
  return {
    id: n.id, channel: n.channel, event: n.event, title: n.title, message: n.message,
    read: n.read, createdAt: n.createdAt.toISOString(),
    metadata: n.metadata ?? null,
    staffId: n.staffId ?? null,
  }
}

export function toAuditLogDTO(l: {
  id: string; actor: string; actorRole: string | null; action: string; entity: string;
  entityId: string | null; details: string | null; createdAt: Date;
}): AuditLogDTO {
  return {
    id: l.id, actor: l.actor, actorRole: l.actorRole, action: l.action, entity: l.entity,
    entityId: l.entityId, details: l.details, createdAt: l.createdAt.toISOString(),
  }
}

// helper to include reviewedAt from raw prescription rows
export function toPrescriptionDTOFull(rx: DbPrescription & { reviewedAt: Date | null }, includeCustomer = false): PrescriptionDTO {
  const dto = toPrescriptionDTO(rx, includeCustomer)
  return { ...dto, reviewedAt: rx.reviewedAt ? rx.reviewedAt.toISOString() : null }
}

/** Order include object for Prisma queries (reused everywhere). */
export const ORDER_INCLUDE = {
  items: true,
  statusHistory: true,
  payments: true,
  prescriptions: {
    include: { reviewedBy: { select: { name: true } }, order: { select: { reference: true } }, user: { select: { name: true, phone: true } } },
  },
  user: { select: { name: true, phone: true } },
} as const

/** Attach avgRating + reviewCount aggregates to product rows (single groupBy query). */
export async function attachRatings<T extends { id: string }>(
  products: T[]
): Promise<(T & { avgRating: number | null; reviewCount: number })[]> {
  if (products.length === 0) return []
  const grouped = await db.review.groupBy({
    by: ["productId"],
    where: { productId: { in: products.map((p) => p.id) }, status: "PUBLISHED" },
    _avg: { rating: true },
    _count: { rating: true },
  })
  const map = new Map(
    grouped.map((g) => [g.productId, { avgRating: g._avg.rating ?? null, reviewCount: g._count.rating }])
  )
  return products.map((p) => ({
    ...p,
    ...(map.get(p.id) ?? { avgRating: null, reviewCount: 0 }),
  }))
}

/** Review row → DTO (author name protected: shows first name + initial). */
export function toReviewDTO(r: {
  id: string; productId: string; rating: number; comment: string | null; createdAt: Date;
  user?: { name: string | null } | null;
}): ReviewDTO {
  const name = r.user?.name?.trim() ?? "Customer"
  const parts = name.split(/\s+/)
  const authorName = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : name
  return {
    id: r.id,
    productId: r.productId,
    rating: r.rating,
    comment: r.comment,
    authorName,
    createdAt: r.createdAt.toISOString(),
  }
}
