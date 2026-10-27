import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const source = (file) => readFileSync(new URL("../" + file, import.meta.url), "utf8")

test("promotions no longer occupy the public landing sections", () => {
  const landing = source("src/components/home/sphere-landing.tsx")
  const legacy = source("src/components/views/home-view.tsx")
  assert.doesNotMatch(landing, /Offers worth knowing about|customerOffers|Current pharmacy offers/)
  assert.doesNotMatch(legacy, /landing-promotions|Current promotions/)
  assert.match(landing, /className=\{styles\.searchSection\}/)
})

test("offers has a navigable dedicated page and checkout destination", () => {
  const routes = source("src/store/use-app-store.ts")
  const page = source("src/app/page.tsx")
  const header = source("src/components/layout/sphere-header.tsx")
  const offers = source("src/components/views/offers-view.tsx")
  assert.match(routes, /offers: "\/offers"/)
  assert.match(routes, /"\/offers": "offers"/)
  assert.match(page, /view === "offers" \? <OffersView/)
  assert.match(header, /name: "Offers", view: "offers"/)
  assert.match(offers, /promotionsApi\.list\(\)/)
  assert.match(offers, /rememberOffer\(code\)/)
  assert.match(offers, /navigate\("checkout", \{ promo: code \}\)/)
})

test("checkout shows server messages and never applies a stale subtotal discount", () => {
  const checkout = source("src/components/views/checkout-view.tsx")
  assert.match(checkout, /err instanceof Error \? err\.message/)
  assert.match(checkout, /aria-live="assertive"/)
  assert.match(checkout, /toast\.error\("Offer could not be applied"/)
  assert.match(checkout, /promo\?\.validatedSubtotal === subtotal \? promo : null/)
  assert.match(checkout, /activePromo \? \{ promotionCode: activePromo\.code \}/)
  assert.match(checkout, /pendingOffer\(\)/)
})

test("server rejects invalid and exhausted codes and public listing omits exhausted offers", () => {
  const validate = source("src/app/api/promotions/validate/route.ts")
  const list = source("src/app/api/promotions/route.ts")
  const orders = source("src/app/api/orders/route.ts")
  assert.match(validate, /Code not found/)
  assert.match(validate, /has expired|has expired|has expired|expired/)
  assert.match(validate, /minimum KSh/)
  assert.match(validate, /promotionRedemption\.count/)
  assert.match(list, /p\.maxUses == null \|\| p\._count\.redemptions < p\.maxUses/)
  assert.match(orders, /PROMOTION_CUSTOMER_LIMIT/)
  assert.match(orders, /PROMOTION_NETWORK_LIMIT/)
  assert.match(orders, /PROMOTION_BROWSER_LIMIT/)
})
