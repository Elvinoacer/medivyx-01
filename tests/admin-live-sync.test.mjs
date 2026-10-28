import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const source = (file) => readFileSync(new URL("../" + file, import.meta.url), "utf8")

test("live cursor endpoint requires a staff session and returns only metadata", () => {
  const route = source("src/app/api/admin/live-changes/route.ts")
  assert.match(route, /requireStaff\(\["ADMIN", "PHARMACIST", "STAFF"\]\)/)
  assert.match(route, /db\.order\.findFirst/)
  assert.match(route, /db\.serviceBooking\.findFirst/)
  assert.match(route, /updatedAt: "desc"/)
  assert.match(route, /createdAt: "desc"/)
  assert.match(route, /orders: \{ change: cursor\(latestOrderChange\), arrival: cursor\(latestOrderArrival\)/)
  assert.match(route, /bookings: \{ change: cursor\(latestBookingChange\), arrival: cursor\(latestBookingArrival\)/)
  assert.match(route, /"Cache-Control": "private, no-store"/)
  assert.doesNotMatch(route, /include:\s*ORDER_INCLUDE|select:\s*\{\s*(customerPhone|customerName)|prescriptions:\s*\{/)
})

test("admin shell learns about customer-created orders and care bookings while open", () => {
  const shell = source("src/components/views/admin/admin-view.tsx")
  assert.match(shell, /ADMIN_SYNC_INTERVAL_MS = 15_000/)
  assert.match(shell, /fetch\("\/api\/admin\/live-changes"/)
  assert.match(shell, /cache: "no-store"/)
  assert.match(shell, /document\.visibilityState === "hidden"/)
  assert.match(shell, /inFlight/)
  assert.match(shell, /setRefreshKey\(\(key\) => key \+ 1\)/)
  assert.match(shell, /"New order received"/)
  assert.match(shell, /"New care appointment"/)
  assert.match(shell, /"visibilitychange"/)
  assert.match(shell, /"PUSH_NOTIFICATION"/)
  assert.match(shell, /window\.clearInterval\(timer\)/)
  assert.match(shell, /previous = snapshot/)
})

test("orders background changes do not wipe selections or the table when disconnected", () => {
  const orders = source("src/components/views/admin/sections/orders-section.tsx")
  assert.match(orders, /const load = useCallback\(async \(searchTerm: string, background = false\)/)
  assert.match(orders, /if \(!background\) \{\s*setLoading\(true\)/)
  assert.match(orders, /if \(request !== ordersRequest\.current\) return/)
  assert.match(orders, /previous\.filter\(\(order\) => !latestIds\.has\(order\.id\)\)/)
  assert.match(orders, /lastRefreshKey\.current === refreshKey/)
  assert.match(orders, /void load\(search, true\)/)
  assert.match(orders, /setRaw\(\(previous\) => previous\.map\(\(order\) => order\.id === updated\.id \? updated : order\)\)/)
  assert.match(orders, /Silent updates must never blank a working queue/)
})

test("booking lists update quietly and staff actions apply optimistically with rollback", () => {
  const bookings = source("src/components/views/admin/sections/service-bookings-section.tsx")
  assert.match(bookings, /const loadRows = useCallback\(async \(background = false\)/)
  assert.match(bookings, /void loadRows\(true\)/)
  assert.match(bookings, /void loadOverview\(\)/)
  assert.match(bookings, /if \(request === rowsRequest\.current && !background\)/)
  assert.match(bookings, /const oldRow = data\?\.items\.find/)
  assert.match(bookings, /const oldDetail = detail\?\.id === id/)
  assert.match(bookings, /items: current\.items\.map\(\(booking\) => booking\.id === id \? \{ \.\.\.booking, \.\.\.optimistic \} : booking\)/)
  assert.match(bookings, /if \(oldRow\) setData/)
  assert.match(bookings, /if \(oldDetail\) setDetail/)
  assert.match(bookings, /\{ status: action\.status \}/)
})

test("cursor polling reads indexed columns", () => {
  const schema = source("prisma/schema.prisma")
  const migration = source("prisma/migrations/20261028194500_admin_live_cursor_indexes/migration.sql")
  assert.equal((schema.match(/@@index\(\[updatedAt, id\]\)/g) || []).length, 2)
  assert.equal((schema.match(/@@index\(\[createdAt, id\]\)/g) || []).length, 2)
  for (const table of ["Order", "ServiceBooking"]) {
    for (const column of ["createdAt", "updatedAt"]) {
      assert.ok(migration.includes(`"${table}_${column}_id_idx"`))
    }
  }
})
