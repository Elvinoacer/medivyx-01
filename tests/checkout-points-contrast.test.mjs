import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8")

test("checkout points redeem panel keeps dark text on a light surface in both themes", () => {
  const checkout = read("src/components/views/checkout-view.tsx")
  const styles = read("src/app/sphere-public.css")

  assert.match(checkout, /sphere-checkout-points-redeem/)
  assert.match(checkout, /sphere-checkout-points-help mt-1 text-xs font-medium/)
  assert.match(checkout, /text-emerald-950 dark:text-emerald-950/)
  assert.match(styles, /\.dark \.sphere-public \.app-page-checkout \.sphere-checkout-points-notice \.sphere-checkout-points-redeem :is\(label,p,span\)/)
  assert.match(styles, /\.sphere-checkout-points-redeem \.sphere-checkout-points-help/)
  assert.match(styles, /background: #fbfdf9 !important/)
  assert.match(styles, /color: #143e31 !important/)
  assert.match(styles, /color: #365c50 !important/)
})
