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

test("admin product selects render above dialogs and forms remain scrollable", () => {
  assert.match(read("src/components/ui/select.tsx"), /z-\[100\]/)
  const catalogue = read("src/components/views/admin/sections/catalogue-section.tsx")
  assert.match(catalogue, /overflow-y-auto overscroll-contain/)
  assert.match(catalogue, /Choose a category\./)
})

test("product image library is lazy and progressively rendered", () => {
  const catalogue = read("src/components/views/admin/sections/catalogue-section.tsx")
  assert.match(catalogue, /Browse gallery/)
  assert.match(catalogue, /useState\(24\)/)
  assert.match(catalogue, /visibleImages\.map/)
  assert.match(catalogue, /added to the reusable gallery/)
})

test("catalogue category labels hide image paths and products support useful sorting", () => {
  const catalogue = read("src/components/views/admin/sections/catalogue-section.tsx")
  assert.doesNotMatch(catalogue, /c\.icon \? `\$\{c\.icon\}/)
  assert.match(catalogue, /Name: A to Z/)
  assert.match(catalogue, /Date: newest first/)
  assert.match(catalogue, /Stock: highest first/)
})

test("browser push obtains and stores a real Firebase registration token", () => {
  const client = read("src/lib/firebase/client.ts")
  assert.match(client, /getToken\(messaging/)
  assert.match(client, /serviceWorkerRegistration: registration/)
  assert.match(client, /NEXT_PUBLIC_FIREBASE_VAPID_KEY/)
  assert.doesNotMatch(client, /return false\s*\n}/)
  assert.doesNotMatch(client, /dev_fcm_/)

  const worker = read("public/firebase-messaging-sw.js")
  assert.match(worker, /PUSH_NOTIFICATION/)
  assert.match(worker, /showNotification/)
})

test("authenticated navigation sticks flush to the viewport top", () => {
  const admin = read("src/components/views/admin/admin-view.tsx")
  assert.match(admin, /admin-sidebar sticky top-0/)
  assert.doesNotMatch(admin, /admin-sidebar sticky top-32/)

  const experience = read("src/app/app-experience.css")
  assert.match(experience, /\.admin-topbar\s*\{[^}]*position: sticky;[^}]*top: 0;/)
  assert.doesNotMatch(experience, /\.admin-topbar\s*\{[^}]*top: (?:4\.25rem|4\.5rem|7\.125rem);/)

  const globals = read("src/app/globals.css")
  assert.match(globals, /\.customer-hub\s*\{[^}]*position: sticky;[^}]*top: 0;/)
})

test("medicine listings use server-side pagination", () => {
  const catalogue = read("src/components/views/admin/sections/catalogue-section.tsx")
  assert.match(catalogue, /ADMIN_PAGE_SIZE = 25/)
  assert.match(catalogue, /Page \{page\} of \{totalPages\}/)
  assert.match(catalogue, /admin: "yes"/)
  assert.doesNotMatch(catalogue, /pageSize: 200/)

  const route = read("src/app/api/products/route.ts")
  assert.match(route, /skip: \(page - 1\) \* pageSize/)
  assert.match(route, /adminView/)
  assert.match(route, /Staff access required/)
})
