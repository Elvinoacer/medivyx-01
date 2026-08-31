import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireStaff } from "@/lib/session"
import { ACTIVE_STATUSES, ORDER_STATUS_LABELS, TERMINAL_STATUSES, type OrderStatus } from "@/lib/constants"

export async function GET() {
  const { error } = await requireStaff()
  if (error) return error

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const startOfWeek = new Date(startOfDay.getTime() - 6 * 24 * 3600 * 1000)
  const start14 = new Date(startOfDay.getTime() - 13 * 24 * 3600 * 1000)

  const [orders, payments, products, users, pendingRx] = await Promise.all([
    db.order.findMany({
      where: { createdAt: { gte: start14 } },
      include: { items: true, payments: true },
      orderBy: { createdAt: "asc" },
    }),
    db.payment.findMany({ where: { status: "SUCCESS", createdAt: { gte: start14 } } }),
    db.product.findMany(),
    db.user.count(),
    db.prescription.count({ where: { status: "PENDING" } }),
  ])

  const allOrders = await db.order.findMany({ include: { items: true } })
  const paidStatuses = new Set(["PAID", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "COMPLETED_PICKUP", "COMPLETED_DELIVERY"])
  const revenueOf = (o: (typeof allOrders)[number]) => (paidStatuses.has(o.status) ? o.total : 0)

  const ordersToday = allOrders.filter((o) => o.createdAt >= startOfDay).length
  const ordersThisWeek = allOrders.filter((o) => o.createdAt >= startOfWeek).length
  const revenueToday = allOrders.filter((o) => o.createdAt >= startOfDay).reduce((s, o) => s + revenueOf(o), 0)
  const revenueThisWeek = allOrders.filter((o) => o.createdAt >= startOfWeek).reduce((s, o) => s + revenueOf(o), 0)
  const revenueTotal = allOrders.reduce((s, o) => s + revenueOf(o), 0)

  const activeOrders = allOrders.filter((o) => ACTIVE_STATUSES.includes(o.status as OrderStatus)).length
  const awaitingPayment = allOrders.filter((o) => o.status === "AWAITING_PAYMENT").length

  // 14-day series (fill gaps)
  const byDay: { date: string; orders: number; revenue: number }[] = []
  for (let d = 13; d >= 0; d--) {
    const day = new Date(startOfDay.getTime() - d * 24 * 3600 * 1000)
    const next = new Date(day.getTime() + 24 * 3600 * 1000)
    const dayOrders = allOrders.filter((o) => o.createdAt >= day && o.createdAt < next)
    byDay.push({
      date: day.toISOString().slice(5, 10),
      orders: dayOrders.length,
      revenue: dayOrders.reduce((s, o) => s + revenueOf(o), 0),
    })
  }

  // top products by quantity sold (paid orders only)
  const productAgg: Record<string, { qty: number; revenue: number }> = {}
  for (const o of allOrders) {
    if (!paidStatuses.has(o.status)) continue
    for (const item of o.items) {
      const key = item.name
      productAgg[key] ??= { qty: 0, revenue: 0 }
      productAgg[key].qty += item.qty
      productAgg[key].revenue += item.lineTotal
    }
  }
  const topProducts = Object.entries(productAgg)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10)

  // Rx vs OTC volume (orders)
  const rxOrders = allOrders.filter((o) => o.type === "PRESCRIPTION" || o.type === "MIXED").length
  const otcOrders = allOrders.filter((o) => o.type === "OTC" || o.type === "RESERVATION").length

  // status breakdown (full lifecycle order)
  const statusCounts: Record<string, number> = {}
  for (const o of allOrders) statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1
  const statusOrder: OrderStatus[] = ["RECEIVED", "UNDER_REVIEW", "PRESCRIPTION_VERIFIED", "AVAILABILITY_CONFIRMED", "AWAITING_PAYMENT", "PAID", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "COMPLETED_PICKUP", "COMPLETED_DELIVERY", "REJECTED", "CANCELLED", "REFUNDED"]
  const statusBreakdown = statusOrder.map((s) => ({ status: s, count: statusCounts[s] ?? 0 }))

  const lowStock = products.filter((p) => p.active && p.stockStatus === "LOW_STOCK").length
  const outOfStock = products.filter((p) => p.active && p.stockStatus === "OUT_OF_STOCK").length

  return NextResponse.json({
    ordersToday,
    revenueToday,
    ordersThisWeek,
    revenueThisWeek,
    revenueTotal,
    pendingPrescriptions: pendingRx,
    awaitingPayment,
    activeOrders,
    lowStockCount: lowStock,
    outOfStockCount: outOfStock,
    totalProducts: products.filter((p) => p.active).length,
    totalCustomers: users,
    ordersByDay: byDay,
    topProducts,
    rxVsOtc: { otc: otcOrders, rx: rxOrders },
    statusBreakdown,
  })
}
