import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

test("production configuration does not bypass build validation", () => {
  const config = read("next.config.ts")
  assert.doesNotMatch(config, /ignoreBuildErrors|ignoreDuringBuilds/)
  assert.match(read(".github/workflows/ci.yml"), /migrate deploy/)
})

test("private prescription storage and one-time OTP contracts are present", () => {
  assert.match(read("src/lib/r2.ts"), /private, no-store/)
  assert.doesNotMatch(read("src/app/api/auth/otp/request/route.ts"), /demoCode/)
  assert.match(read("prisma/schema.prisma"), /codeHash\s+String/)
})

test("payment callbacks authenticate and verify provider state", () => {
  assert.match(read("src/app/api/payments/intasend/webhook/route.ts"), /verifyIntaSendWebhook/)
  assert.match(read("src/app/api/payments/mpesa/callback/route.ts"), /MPESA_CALLBACK_TOKEN/)
})

test("deep-link routes and release migration exist", () => {
  assert.ok(existsSync(new URL("../src/app/[...route]/page.tsx", import.meta.url)))
  assert.ok(existsSync(new URL("../prisma/migrations/20260903000000_security_hardening/migration.sql", import.meta.url)))
})

test("popular product card has no nested interactive controls", () => {
  const card = read("src/components/shared/premium-popular-card.tsx")
  assert.doesNotMatch(card, /className="block w-full text-left"/)
})

test("legacy staff password migration cannot block a valid login", () => {
  const route = read("src/app/api/auth/staff-login/route.ts")
  assert.match(route, /!validatePassword\(password\)/)
  assert.match(route, /await createSession/)
})
