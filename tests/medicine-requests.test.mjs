import test from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { PrismaClient } from "@prisma/client"
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3"

// Opt-in integration test against a running app and a disposable local database.
// Both the app and this process must use MEDICINE_REQUEST_TEST_DATABASE_URL as DATABASE_URL.
const base = process.env.MEDICINE_REQUEST_TEST_URL
const databaseUrl = process.env.MEDICINE_REQUEST_TEST_DATABASE_URL

test("medicine requests: guest submission, private photos, staff workflow and validation", {
  skip: !base || !databaseUrl,
  timeout: 180_000,
}, async (t) => {
  const target = new URL(base)
  const database = new URL(databaseUrl)
  assert.ok(["localhost", "127.0.0.1"].includes(target.hostname), "Use a local test server")
  assert.ok(["localhost", "127.0.0.1"].includes(database.hostname) && database.pathname.includes("test"), "Use a disposable local test database")
  const db = new PrismaClient({ datasourceUrl: databaseUrl })
  const suffix = randomUUID()
  const ids = []
  const staffIds = []
  let userId
  const call = (path, { cookie, data, method = "GET" } = {}) => fetch(`${base}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "x-forwarded-for": `test-${suffix}`, ...(cookie ? { Cookie: cookie } : {}) },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  })
  const payload = { medicineName: `Integration medicine ${suffix}`, phone: "0712 345 678" }
  const makeStaff = async (role) => {
    const staff = await db.staffUser.create({ data: { name: `Test ${role}`, email: `${role}-${suffix}@example.test`, passwordHash: "unused", role } })
    staffIds.push(staff.id)
    const token = randomUUID()
    await db.session.create({ data: { staffId: staff.id, token, role, expiresAt: new Date(Date.now() + 60_000 * 30) } })
    return `sphere_session=${token}`
  }
  try {
    const admin = await makeStaff("ADMIN")
    const staff = await makeStaff("STAFF")
    const pharmacist = await makeStaff("PHARMACIST")
    const rider = await makeStaff("RIDER")
    const customer = await db.user.create({ data: { name: "Test customer" } })
    userId = customer.id
    const customerToken = randomUUID()
    await db.session.create({ data: { userId, token: customerToken, role: "CUSTOMER", expiresAt: new Date(Date.now() + 60_000 * 30) } })
    const customerCookie = `sphere_session=${customerToken}`

    await t.test("guest can submit without a photo; phone is normalized", async () => {
      const response = await call("/api/medicine-requests", { method: "POST", data: payload })
      assert.equal(response.status, 201, await response.clone().text())
      const { id } = await response.json()
      ids.push(id)
      const saved = await db.medicineRequest.findUniqueOrThrow({ where: { id } })
      assert.equal(saved.phone, "+254712345678")
      assert.equal(saved.status, "NEW")
      assert.equal(saved.storageKey, null)
    })

    await t.test("guests, customers and riders cannot read or change the queue", async () => {
      for (const cookie of [undefined, customerCookie, rider]) {
        const expected = cookie === rider ? 403 : 401
        assert.equal((await call("/api/admin/medicine-requests", { cookie })).status, expected)
        assert.equal((await call("/api/admin/medicine-requests", { cookie, method: "PATCH", data: { id: ids[0], status: "FULFILLED", staffNotes: "" } })).status, expected)
        assert.equal((await call(`/api/admin/medicine-requests/${ids[0]}/photo`, { cookie })).status, expected)
      }
    })

    await t.test("staff can find requests, save status and notes, and create an audit entry", async () => {
      for (const cookie of [admin, staff, pharmacist]) {
        const response = await call(`/api/admin/medicine-requests?search=${suffix}&status=NEW`, { cookie })
        assert.equal(response.status, 200)
        const result = await response.json()
        assert.equal(result.total, 1)
        assert.equal(result.items[0].photoUrl, null)
      }
      const response = await call("/api/admin/medicine-requests", { cookie: staff, method: "PATCH", data: { id: ids[0], status: "CONTACTED", staffNotes: "Called customer; checking supplier." } })
      assert.equal(response.status, 200)
      assert.equal((await response.json()).staffNotes, "Called customer; checking supplier.")
      assert.equal(await db.auditLog.count({ where: { entityId: ids[0], action: "UPDATE_MEDICINE_REQUEST" } }), 1)
      const filtered = await call(`/api/admin/medicine-requests?search=${suffix}&status=NEW`, { cookie: admin })
      assert.equal((await filtered.json()).total, 0)
      const missingPhoto = await call(`/api/admin/medicine-requests/${ids[0]}/photo`, { cookie: admin })
      assert.equal(missingPhoto.status, 404)
      const invalid = await call("/api/admin/medicine-requests", { cookie: admin, method: "PATCH", data: { id: ids[0], status: "BOGUS", staffNotes: "" } })
      assert.equal(invalid.status, 400)
      const missing = await call("/api/admin/medicine-requests", { cookie: admin, method: "PATCH", data: { id: "missing", status: "CONTACTED", staffNotes: "" } })
      assert.equal(missing.status, 404)
    })

    await t.test("rejects missing fields, bad phones, oversized bodies and disguised photos", async () => {
      for (const data of [null, {}, { ...payload, medicineName: " " }, { ...payload, phone: "123" }, { ...payload, phone: "call0712345678" }, { ...payload, photo: { name: "fake.png", type: "image/png", data: Buffer.from("not an image").toString("base64") } }]) {
        assert.equal((await call("/api/medicine-requests", { method: "POST", data })).status, 400)
      }
      const huge = await call("/api/medicine-requests", { method: "POST", data: { ...payload, photo: { name: "large.png", type: "image/png", data: "A".repeat(4_200_000) } } })
      assert.equal(huge.status, 413)
    })

    await t.test("optional photo uploads stay private and can be viewed by staff", { skip: !process.env.R2_ACCOUNT_ID }, async () => {
      // Use a separate rate-limit identity after the invalid-input tests.
      const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII="
      const response = await fetch(`${base}/api/medicine-requests`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": `photo-${suffix}` }, body: JSON.stringify({ ...payload, photo: { name: "medicine.png", type: "image/png", data: png } }) })
      assert.equal(response.status, 201, await response.clone().text())
      const { id } = await response.json()
      ids.push(id)
      assert.equal((await call(`/api/admin/medicine-requests/${id}/photo`)).status, 401)
      const photo = await call(`/api/admin/medicine-requests/${id}/photo`, { cookie: pharmacist })
      assert.equal(photo.status, 200)
      assert.equal(photo.headers.get("content-type"), "image/png")
      assert.match(photo.headers.get("cache-control"), /no-store/)
      assert.deepEqual(Buffer.from(await photo.arrayBuffer()), Buffer.from(png, "base64"))
    })
  } finally {
    const rows = await db.medicineRequest.findMany({ where: { id: { in: ids } } })
    const keys = rows.flatMap((row) => row.storageKey ? [row.storageKey] : [])
    if (keys.length) {
      const client = new S3Client({ region: "auto", endpoint: process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY } })
      try { for (const Key of keys) await client.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key })) } finally { client.destroy() }
    }
    await db.auditLog.deleteMany({ where: { entityId: { in: ids } } })
    await db.medicineRequest.deleteMany({ where: { id: { in: ids } } })
    await db.staffUser.deleteMany({ where: { id: { in: staffIds } } })
    if (userId) await db.user.delete({ where: { id: userId } })
    await db.$disconnect()
  }
})
