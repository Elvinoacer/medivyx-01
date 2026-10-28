import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const source = (file) => readFileSync(new URL("../" + file, import.meta.url), "utf8")

test("checkout payment choice and precise drop-off survive into the order DTO", () => {
  const schema = source("prisma/schema.prisma")
  const migration = source("prisma/migrations/20261028000000_order_payment_intent/migration.sql")
  const create = source("src/app/api/orders/route.ts")
  const dto = source("src/lib/dto.ts")
  assert.match(schema, /paymentMethod\s+String\?/)
  assert.match(migration, /ALTER TABLE "Order" ADD COLUMN "paymentMethod"/)
  assert.match(create, /paymentMethod: paymentMethod === "CASH"/)
  assert.match(create, /deliveryArea = address\.area \|\|/)
  assert.match(dto, /paymentMethod: order\.paymentMethod \?\? null/)
  assert.match(dto, /deliveryLatitude: order\.deliveryLatitude \?\? null/)
  assert.match(dto, /deliveryLongitude: order\.deliveryLongitude \?\? null/)
})

test("unpaid COD can be prepared, but unreviewed Rx and unknown payment choices cannot", () => {
  const prepare = source("src/app/api/orders/[id]/prepare/route.ts")
  assert.match(prepare, /requireStaff\(\["ADMIN", "PHARMACIST", "STAFF"\]\)/)
  assert.match(prepare, /order\.paymentMethod === "CASH_ON_DELIVERY"/)
  assert.match(prepare, /order\.status === "PAID" && paid/)
  assert.match(prepare, /order\.inventoryReservedAt/)
  assert.match(prepare, /APPROVED", "PARTIALLY_APPROVED"/)
  assert.match(prepare, /PENDING", "PROCESSING", "REFUND_PENDING"/)
  assert.match(prepare, /version: order\.version/)
  assert.match(prepare, /status: "PREPARING"/)
  assert.doesNotMatch(prepare, /status: "PAID", version:/)
})

test("only a rider on an explicitly COD delivery can record cash", () => {
  const cash = source("src/app/api/orders/[id]/cash-confirm/route.ts")
  const transition = source("src/app/api/orders/[id]/route.ts")
  assert.match(cash, /session\.staffRole === "RIDER" && .*order\.paymentMethod !== "CASH_ON_DELIVERY"/)
  assert.match(transition, /status === "COMPLETED_DELIVERY" && !order\.payments\.some/)
  assert.match(transition, /status === "OUT_FOR_DELIVERY" && \(order\.fulfillment !== "DELIVERY" \|\| !order\.riderId\)/)
})

test("orders queue provides a bulk action lane and visible next steps", () => {
  const orders = source("src/components/views/admin/sections/orders-section.tsx")
  assert.match(orders, /One-click order processing/)
  assert.match(orders, /Select eligible/)
  assert.match(orders, /ordersApi\.startPreparing/)
  assert.match(orders, /batchType === "ready"/)
  assert.match(orders, /Confirm all selected parcels/)
  assert.match(orders, /Other status actions/)
  assert.match(orders, /Priced delivery zone/)
  assert.match(orders, /deliveryMapUrl\(order\)/)
})

test("dispatch and rider surfaces show both zone and exact location; COD delivery is explicitly confirmed", () => {
  const dispatch = source("src/components/views/admin/sections/dispatch-control-room.tsx")
  const rider = source("src/components/views/admin/sections/dispatch-section.tsx")
  assert.match(dispatch, /order\.deliveryLatitude != null && order\.deliveryLongitude != null/)
  assert.match(dispatch, /Cash to collect at drop-off/)
  assert.match(rider, /Open exact drop-off map/)
  assert.match(rider, /Cash received & Delivered/)
  assert.match(rider, /await ordersApi\.markPaidCash\(order\.id\)/)
  assert.match(rider, /await ordersApi\.updateStatus\(order\.id, "COMPLETED_DELIVERY"/)
  assert.match(rider, /Only continue after physically collecting/)
})
