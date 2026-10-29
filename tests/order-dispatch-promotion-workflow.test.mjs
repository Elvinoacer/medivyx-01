import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const read = (file) => readFileSync(new URL("../" + file, import.meta.url), "utf8")

test("checkout requires an explicit fulfillment choice and only asks for a zone with the address", () => {
  const checkout = read("src/components/views/checkout-view.tsx")
  const ordersApi = read("src/app/api/orders/route.ts")
  assert.match(checkout, /useState<"PICKUP" \| "DELIVERY" \| null>\(null\)/)
  assert.match(checkout, /if \(!fulfillment\) throw new Error/)
  assert.match(checkout, /disabled=\{!fulfillment\}/)
  assert.match(checkout, /id="guest-zone"/)
  assert.match(checkout, /addressMode === "saved" && user/)
  assert.doesNotMatch(checkout, /Choose your delivery zone first \(step 1\)/)
  assert.match(ordersApi, /body\.fulfillment !== "DELIVERY" && body\.fulfillment !== "PICKUP"/)
})

test("private promotions are invisible in public discovery but remain redeemable by code", () => {
  const schema = read("prisma/schema.prisma")
  const migration = read("prisma/migrations/20261028190000_private_promotion_visibility/migration.sql")
  const collection = read("src/app/api/promotions/route.ts")
  const detail = read("src/app/api/promotions/[id]/route.ts")
  const validate = read("src/app/api/promotions/validate/route.ts")
  const order = read("src/app/api/orders/route.ts")
  assert.match(schema, /isPublic\s+Boolean\s+@default\(true\)/)
  assert.match(migration, /ALTER TABLE "Promotion" ADD COLUMN "isPublic"/)
  assert.match(collection, /isPublic: true/)
  assert.match(collection, /isPublic: body\.isPublic !== false/)
  assert.match(detail, /data\.isPublic = body\.isPublic/)
  assert.match(validate, /where:\s*\{\s*code/)
  assert.match(order, /promotion = await db\.promotion\.findUnique\(\{ where: \{ code \} \}\)/)
})

test("orders default to newest-first and older records are retrievable by cursor", () => {
  const orders = read("src/components/views/admin/sections/orders-section.tsx")
  const api = read("src/app/api/orders/route.ts")
  assert.match(orders, /useState<"newest" \| "oldest" \| "attention">\("newest"\)/)
  assert.match(orders, /Longest waiting first/)
  assert.match(orders, /Total & age/)
  assert.match(orders, /In queue/)
  assert.match(orders, /Load older orders/)
  assert.match(api, /cursor: \{ id: cursor \}, skip: 1/)
})

test("dispatch handoff is eligible-only and server-searchable, with in-place pharmacist review", () => {
  const orders = read("src/components/views/admin/sections/orders-section.tsx")
  const dispatch = read("src/components/views/admin/sections/dispatch-control-room.tsx")
  const api = read("src/app/api/orders/route.ts")
  assert.match(orders, /DISPATCH_STATUSES\.includes\(order\.status\)/)
  assert.match(orders, /onReviewPrescription\(rx\.id\)/)
  assert.match(orders, /<ReviewDialog/)
  assert.match(dispatch, /ordersApi\.dispatchBoard\(searchTerm\)/)
  assert.match(dispatch, /Compact review/)
  assert.match(api, /scope === "dispatch"/)
  assert.match(api, /fulfillment: "DELIVERY", status: \{ in: DISPATCH_STATUSES \}/)
})
