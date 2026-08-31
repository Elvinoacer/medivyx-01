import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { audit } from "@/lib/notify"
import { requireStaff } from "@/lib/session"
import { STOCK_STATUSES } from "@/lib/constants"

/** CSV import — header columns:
 *  name,sku,category,brand,packSize,price,compareAtPrice,stockQty,stockStatus,requiresPrescription,description,image
 */
export async function POST(request: Request) {
  const { session, error } = await requireStaff(["ADMIN", "PHARMACIST"])
  if (error) return error
  try {
    const body = await request.json()
    const csv = String(body.csv ?? "").trim()
    if (!csv) return NextResponse.json({ error: "Paste CSV content or choose a file first." }, { status: 400 })

    const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0)
    if (lines.length < 2) return NextResponse.json({ error: "CSV needs a header row and at least one product row." }, { status: 400 })

    const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase())
    const idx = (name: string) => header.indexOf(name)
    const iName = idx("name"), iSku = idx("sku"), iCat = idx("category"), iBrand = idx("brand"), iPack = idx("packsize")
    const iPrice = idx("price"), iCompare = idx("compareatprice"), iQty = idx("stockqty"), iStatus = idx("stockstatus")
    const iRx = idx("requiresprescription"), iDesc = idx("description"), iImage = idx("image")
    if (iName === -1 || iPrice === -1) {
      return NextResponse.json({ error: "CSV must include at least 'name' and 'price' columns." }, { status: 400 })
    }

    const categories = await db.category.findMany()
    let created = 0
    let updated = 0
    const errors: string[] = []

    for (let r = 1; r < lines.length; r++) {
      const cols = splitCsvLine(lines[r])
      const rowNo = r + 1
      const name = (cols[iName] ?? "").trim()
      if (!name) { errors.push(`Row ${rowNo}: missing name`); continue }
      const price = Number((cols[iPrice] ?? "").replace(/[^0-9.]/g, ""))
      if (!Number.isFinite(price) || price <= 0) { errors.push(`Row ${rowNo}: invalid price "${cols[iPrice]}"`); continue }

      const qty = Math.max(0, Math.trunc(Number(cols[iQty] ?? 0)) || 0)
      let stockStatus = (cols[iStatus] ?? "").trim().toUpperCase().replace(/ /g, "_")
      if (!(STOCK_STATUSES as readonly string[]).includes(stockStatus)) stockStatus = qty <= 0 ? "OUT_OF_STOCK" : qty <= 5 ? "LOW_STOCK" : "IN_STOCK"

      const catName = (cols[iCat] ?? "").trim().toLowerCase()
      const category = catName ? categories.find((c) => c.name.toLowerCase() === catName || c.slug === catName) : null
      if (catName && !category) errors.push(`Row ${rowNo}: unknown category "${cols[iCat]}" (kept uncategorised)`)

      const rxRaw = (cols[iRx] ?? "").trim().toLowerCase()
      const requiresPrescription = ["1", "true", "yes", "y", "rx", "true()"].includes(rxRaw)

      const sku = (iSku >= 0 ? cols[iSku]?.trim() : "") || `SPH-IMP-${r}${Date.now().toString(36).slice(-3).toUpperCase()}`
      const data = {
        name,
        brand: iBrand >= 0 ? cols[iBrand]?.trim() || null : null,
        packSize: iPack >= 0 ? cols[iPack]?.trim() || null : null,
        price,
        compareAtPrice: iCompare >= 0 && cols[iCompare]?.trim() ? Number(cols[iCompare].replace(/[^0-9.]/g, "")) || null : null,
        stockQty: qty,
        stockStatus,
        requiresPrescription,
        description: iDesc >= 0 ? cols[iDesc]?.trim() || "" : "",
        image: iImage >= 0 ? cols[iImage]?.trim() || "💊" : "💊",
        categoryId: category?.id ?? null,
      }

      try {
        const existing = await db.product.findUnique({ where: { sku } })
        if (existing) {
          await db.product.update({ where: { sku }, data })
          updated++
        } else {
          await db.product.create({ data: { ...data, sku } })
          created++
        }
      } catch (e) {
        errors.push(`Row ${rowNo}: could not save (${(e as Error).message})`)
      }
    }

    await audit(session.staffName ?? "Staff", session.staffRole, "CSV_IMPORT", "Product", null, `Created ${created}, updated ${updated}, ${errors.length} errors`)
    return NextResponse.json({ created, updated, errors })
  } catch {
    return NextResponse.json({ error: "Could not process the CSV import." }, { status: 500 })
  }
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ } else { inQuotes = !inQuotes }
    } else if (ch === "," && !inQuotes) {
      out.push(cur); cur = ""
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}
