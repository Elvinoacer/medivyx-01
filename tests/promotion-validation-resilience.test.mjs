import test from "node:test"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"

const readSource = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8")

// Evaluate the actual, TypeScript-compatible core of promotionIdentity.
// The boundary contains no Next.js/Prisma calls; external functions are stubbed.
function identityFunction(env, tokenHash = () => { throw new Error("HMAC key unavailable") }) {
  const source = readSource("src/lib/promotions.ts")
  const match = source.match(/export function promotionIdentity\(request: NextRequest\) \{[\s\S]*?\n\}\n/)
  assert.ok(match, "expected public promotionIdentity function")
  const code = match[0].replace("export function promotionIdentity(request: NextRequest)", "function promotionIdentity(request)")
  return runInNewContext(code + "\npromotionIdentity", {
    process: { env },
    createHash,
    tokenHash,
    clientIp: (request) => request.ip,
    promoBrowserId: (request) => request.device,
  })
}

test("missing HMAC key never stores a reversible IP hash and keeps random browser token checks working", () => {
  const identify = identityFunction({})
  const device = "d".repeat(32) // opaque, high-entropy cookie in production
  const result = identify({ ip: "192.0.2.5", device })
  assert.equal(result.ipHash, null, "IP limits must fail closed without a secure key")
  assert.equal(result.browserHash, createHash("sha256").update("promo:browser:v1:" + device).digest("hex"))
  assert.equal(identify({ ip: "192.0.2.5", device }).browserHash, result.browserHash)
  assert.notEqual(identify({ ip: "192.0.2.5", device: "e".repeat(32) }).browserHash, result.browserHash)
})

test("existing configured HMAC hashing remains compatible with past redemptions", () => {
  const key = "secure-key-" + "x".repeat(40)
  const calls = []
  const identify = identityFunction({ TOKEN_HASH_SECRET: key }, (input) => {
    calls.push(input)
    return "hmac:" + input
  })
  const result = identify({ ip: "203.0.113.7", device: "t".repeat(32) })
  assert.equal(result.ipHash, "hmac:promo:ip:v1:203.0.113.7")
  assert.equal(result.browserHash, "hmac:promo:browser:v1:" + "t".repeat(32))
  assert.equal(calls.length, 2)
})

test("missing device ID never invents browser eligibility", () => {
  const identify = identityFunction({})
  assert.equal(identify({ ip: "unknown", device: null }).browserHash, null)
})

test("promotion server failures carry a reference and the network limit remains fail closed", () => {
  const validator = readSource("src/app/api/promotions/validate/route.ts")
  const orders = readSource("src/app/api/orders/route.ts")
  assert.match(validator, /prismaCode: code/)
  assert.match(validator, /errorId = randomUUID\(\)/)
  assert.match(validator, /\{ status: 503/)
  assert.match(validator, /promo\.perIpLimit != null && !ipHash/)
  assert.match(orders, /promotion\?\.perIpLimit != null && !ipHash/)
  assert.match(orders, /promotion \? promotionIdentity\(request\) : \{ipHash:null,browserHash:null\}/)
  assert.match(orders, /PROMOTION_CUSTOMER_LIMIT/)
  assert.match(orders, /PROMOTION_BROWSER_LIMIT/)
})
