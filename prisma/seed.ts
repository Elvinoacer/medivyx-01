/**
 * Seed script — populates the PostgreSQL database with a realistic demo dataset.
 * Run: bun prisma/seed.ts
 */
import { PrismaClient } from "@prisma/client"
import { hashPassword, orderReference, pickupCode } from "../src/lib/hash"

const db = new PrismaClient()

async function main() {
  console.log("Seeding Sphere Pharmacy database…")

  // wipe (idempotent re-runs)
  await db.payment.deleteMany()
  await db.orderStatusHistory.deleteMany()
  await db.orderItem.deleteMany()
  await db.prescription.deleteMany()
  await db.order.deleteMany()
  await db.notification.deleteMany()
  await db.notificationPref.deleteMany()
  await db.address.deleteMany()
  await db.session.deleteMany()
  await db.otpCode.deleteMany()
  await db.auditLog.deleteMany()
  await db.promotion.deleteMany()
  await db.review.deleteMany()
  await db.productAlert.deleteMany()
  await db.product.deleteMany()
  await db.category.deleteMany()
  await db.staffUser.deleteMany()
  await db.user.deleteMany()
  await db.setting.deleteMany()

  // ---------- Settings ----------
  const pharmacySettings = {
    name: "Sphere Pharmacy",
    tagline: "Your community pharmacy on Lumumba Drive, Roysambu",
    phone: "+254707475208",
    whatsapp: "254707475208",
    email: "orders@spherepharmacy.co.ke",
    address: "Lumumba Drive, Roysambu, Nairobi, Kenya",
    hoursLabel: "Open daily · 8:00 AM – 10:30 PM",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Sphere+Pharmacy+Lumumba+Drive+Roysambu+Nairobi",
  }
  const deliverySettings = {
    mode: "zone",
    flatFee: 200,
    freeOver: 3000,
    nightDelivery: false,
    zones: [
      { name: "Roysambu / TRM area", fee: 150 },
      { name: "Kasarani", fee: 200 },
      { name: "Githurai 44", fee: 250 },
      { name: "Ruaraka / Baba Dogo", fee: 250 },
      { name: "Nairobi CBD", fee: 400 },
      { name: "Other Nairobi areas", fee: 500 },
    ],
  }
  const complianceSettings = {
    premiseLicenceNumber: "", // intentionally empty — pending client's current licence
    premiseLicenceExpiry: "",
    superintendentName: "",
    superintendentReg: "",
    notes:
      "No licence details are displayed publicly yet. The 2024 PPB record found in research is NOT current and must not be published. Complete this section once the client supplies their current licence.",
  }
  await db.setting.create({ data: { key: "pharmacy", value: JSON.stringify(pharmacySettings) } })
  await db.setting.create({ data: { key: "delivery", value: JSON.stringify(deliverySettings) } })
  await db.setting.create({ data: { key: "compliance", value: JSON.stringify(complianceSettings) } })

  // ---------- Staff ----------
  const admin = await db.staffUser.create({
    data: {
      name: "Sphere Admin",
      email: "admin@spherepharmacy.co.ke",
      phone: "+254707475208",
      passwordHash: hashPassword("admin123"),
      role: "ADMIN",
      title: "Owner / Manager",
    },
  })
  const pharmacist = await db.staffUser.create({
    data: {
      name: "Hilda Khasaya",
      email: "pharmacist@spherepharmacy.co.ke",
      phone: "+254707475209",
      passwordHash: hashPassword("pharm123"),
      role: "PHARMACIST",
      title: "Pharmaceutical Technologist",
    },
  })
  await db.staffUser.create({
    data: {
      name: "Brian Otieno",
      email: "staff@spherepharmacy.co.ke",
      phone: "+254707475210",
      passwordHash: hashPassword("staff123"),
      role: "STAFF",
      title: "Counter / Fulfilment",
    },
  })
  const rider = await db.staffUser.create({
    data: {
      name: "Kevin Mwangi",
      email: "rider@spherepharmacy.co.ke",
      phone: "+254707475211",
      passwordHash: hashPassword("rider123"),
      role: "RIDER",
      title: "Delivery Rider",
    },
  })
  console.log("staff seeded")

  // ---------- Categories ----------
  const catsData: [string, string, string, string, number][] = [
    // name, slug, description, icon, order
    ["Prescription Medicines", "prescription", "Prescription-only medicines requiring pharmacist verification", "/images/categories/cat-prescription.webp", 1],
    ["OTC Medicines", "otc", "Over-the-counter medicines you can order without a prescription", "/images/categories/cat-otc.webp", 2],
    ["Pain & Fever", "pain-fever", "Analgesics and antipyretics for pain and fever relief", "/images/categories/cat-pain-fever.webp", 3],
    ["Cold & Flu", "cold-flu", "Relief for coughs, colds, congestion and flu symptoms", "/images/categories/cat-cold-flu.webp", 4],
    ["Gastrointestinal", "gastro", "Antacids, ORS, anti-diarrhoeals and digestive health", "/images/categories/cat-gastro.webp", 5],
    ["Allergy", "allergy", "Antihistamines and allergy relief products", "/images/categories/cat-allergy.webp", 6],
    ["Vitamins & Supplements", "vitamins", "Multivitamins, minerals and daily supplements", "/images/categories/cat-vitamins.webp", 7],
    ["Mother & Baby", "mother-baby", "Baby care, maternal health and feeding essentials", "/images/categories/cat-mother-baby.webp", 8],
    ["Personal Care", "personal-care", "Everyday hygiene and personal care essentials", "/images/categories/cat-personal-care.webp", 9],
    ["Dermatology / Skin Care", "skin-care", "Skin treatments, moisturisers and dermatological care", "/images/categories/cat-skin-care.webp", 10],
    ["Sexual & Reproductive Health", "sexual-health", "Contraception, intimacy and reproductive health products", "/images/categories/cat-sexual-health.webp", 11],
    ["Diabetes Care", "diabetes", "Glucose monitoring and diabetes management supplies", "/images/categories/cat-diabetes.webp", 12],
    ["Blood Pressure / Heart Health", "heart-health", "BP monitors and cardiovascular health support", "/images/categories/cat-heart-health.webp", 13],
    ["First Aid", "first-aid", "Wound care, antiseptics and first-aid kits", "/images/categories/cat-first-aid.webp", 14],
    ["Medical Devices", "medical-devices", "Thermometers, nebulizers, BP monitors and more", "/images/categories/cat-medical-devices.webp", 15],
    ["Diagnostic Products", "diagnostics", "Test kits and screening products", "/images/categories/cat-diagnostics.webp", 16],
  ]
  const catMap: Record<string, string> = {}
  for (const [name, slug, description, icon, sortOrder] of catsData) {
    const c = await db.category.create({ data: { name, slug, description, icon, sortOrder } })
    catMap[slug] = c.id
  }
  console.log("categories seeded")

  // ---------- Products (demo catalogue — client will load real inventory via CSV) ----------
  interface P {
    n: string; sku: string; cat: string; brand: string; pack: string; price: number;
    compare?: number; rx?: boolean; stock: string; qty: number; img: string; desc: string; usage?: string; warn?: string
  }
  const products: P[] = [
    // Pain & fever
    { n: "Panadol Extra", sku: "SPH-PE-001", cat: "pain-fever", brand: "GSK", pack: "24 tablets", price: 250, compare: 300, stock: "IN_STOCK", qty: 140, img: "/images/products/panadol-tablets.webp", desc: "Paracetamol 500mg + Caffeine 65mg tablets for fast relief of headaches, migraines, dental pain and period pain.", usage: "Adults: 2 tablets every 4–6 hours as needed. Max 8 tablets in 24 hours.", warn: "Do not exceed stated dose. Avoid other paracetamol-containing medicines." },
    { n: "Brufen 400", sku: "SPH-BR-002", cat: "pain-fever", brand: "Abbott", pack: "30 tablets", price: 320, stock: "IN_STOCK", qty: 96, img: "/images/products/ibuprofen-tablets.webp", desc: "Ibuprofen 400mg film-coated tablets for pain, inflammation and fever.", usage: "Adults: 1 tablet 3 times daily after food.", warn: "Avoid if you have stomach ulcers or are on blood thinners. Not for children under 12 without advice." },
    { n: "Diclofenac Gel 1%", sku: "SPH-DF-003", cat: "pain-fever", brand: "Generic", pack: "30g tube", price: 380, stock: "IN_STOCK", qty: 42, img: "/images/products/diclofenac-gel.webp", desc: "Topical anti-inflammatory gel for muscle and joint pain, sprains and strains.", usage: "Apply a thin layer to affected area 3–4 times daily.", warn: "For external use only. Wash hands after use." },
    { n: "Aspirin 75mg (Cardio)", sku: "SPH-AS-004", cat: "heart-health", brand: "Reckitt", pack: "28 tablets", price: 180, rx: true, stock: "IN_STOCK", qty: 88, img: "/images/products/aspirin-tablets.webp", desc: "Low-dose aspirin for cardiovascular protection as prescribed by your doctor.", usage: "As directed by your prescriber — typically 1 tablet daily after food.", warn: "Prescription-only after pharmacist review. Not for pain relief at this dose." },
    // Cold & flu
    { n: "Actifed Multi-Action", sku: "SPH-AF-010", cat: "cold-flu", brand: "GSK", pack: "15 tablets", price: 350, stock: "IN_STOCK", qty: 60, img: "/images/products/cold-flu-tablets.webp", desc: "Decongestant and antihistamine combination for colds, flu and allergies with blocked sinuses.", usage: "1 tablet up to 3 times daily. Adults and children over 12.", warn: "Caution with high blood pressure. May cause drowsiness." },
    { n: "Theraflu Lemon", sku: "SPH-TF-011", cat: "cold-flu", brand: "Novartis", pack: "10 sachets", price: 520, compare: 620, stock: "IN_STOCK", qty: 35, img: "/images/products/cold-sachets.webp", desc: "Hot lemon sachets with paracetamol and vitamin C for cold and flu symptom relief.", usage: "Dissolve 1 sachet in hot water every 4–6 hours. Max 6 sachets daily.", warn: "Contains paracetamol — do not combine with other paracetamol products." },
    { n: "Strepsils Honey & Lemon", sku: "SPH-ST-012", cat: "cold-flu", brand: "RB", pack: "16 lozenges", price: 190, stock: "IN_STOCK", qty: 210, img: "/images/products/throat-lozenges.webp", desc: "Antibacterial lozenges for sore throat relief.", usage: "Dissolve 1 lozenge slowly every 2–3 hours. Max 12 in 24 hours." },
    { n: "Ventolin Inhaler 100mcg", sku: "SPH-VE-013", cat: "prescription", brand: "GSK", pack: "200 puffs", price: 950, rx: true, stock: "LOW_STOCK", qty: 4, img: "/images/products/asthma-inhaler.webp", desc: "Salbutamol reliever inhaler for asthma and reversible airway obstruction.", usage: "1–2 puffs when needed, up to 4 times daily.", warn: "Prescription-only. Pharmacist will verify your prescription before dispensing." },
    // Gastrointestinal
    { n: "Eno Fruit Salts", sku: "SPH-EN-020", cat: "gastro", brand: "GSK", pack: "170g tin", price: 240, stock: "IN_STOCK", qty: 130, img: "/images/products/antacid-powder.webp", desc: "Fast-acting antacid for heartburn, indigestion and stomach upset.", usage: "Dissolve 1 teaspoon in water and drink as needed." },
    { n: "ORS Sachets (WHO)", sku: "SPH-OR-021", cat: "gastro", brand: "Generic", pack: "20 sachets", price: 150, stock: "IN_STOCK", qty: 300, img: "/images/products/ors-sachets.webp", desc: "Oral rehydration salts for diarrhoea and dehydration — WHO formulation.", usage: "Dissolve 1 sachet in 200ml clean water. Drink after every loose stool." },
    { n: "Buscopan 10mg", sku: "SPH-BU-022", cat: "gastro", brand: "Sanofi", pack: "20 tablets", price: 420, rx: true, stock: "IN_STOCK", qty: 55, img: "/images/products/stomach-cramp-tablets.webp", desc: "Hyoscine butylbromide for stomach cramps and IBS-associated cramping pain.", usage: "Adults: 1–2 tablets 4 times daily as needed.", warn: "Prescription-only in Kenya — pharmacist review required." },
    { n: "Loperamide 2mg", sku: "SPH-LO-023", cat: "gastro", brand: "Generic", pack: "12 capsules", price: 160, rx: true, stock: "IN_STOCK", qty: 70, img: "/images/products/diarrhoea-capsules.webp", desc: "Anti-diarrhoeal capsules for short-term relief of acute diarrhoea.", warn: "Prescription-only. Not for children under 12. Do not use if you have fever or blood in stool.", usage: "2 capsules initially, then 1 after each loose stool. Max 6 daily." },
    // Allergy
    { n: "Zyrtec 10mg", sku: "SPH-ZY-030", cat: "allergy", brand: "UCB", pack: "10 tablets", price: 450, stock: "IN_STOCK", qty: 80, img: "/images/products/allergy-tablets-white.webp", desc: "Cetirizine dihydrochloride once-daily relief for hayfever and allergies.", usage: "Adults: 1 tablet daily. May cause mild drowsiness." },
    { n: "Clarityn 10mg", sku: "SPH-CL-031", cat: "allergy", brand: "Bayer", pack: "10 tablets", price: 520, stock: "IN_STOCK", qty: 65, img: "/images/products/allergy-tablets-blister.webp", desc: "Loratadine non-drowsy antihistamine for allergies and hives.", usage: "Adults: 1 tablet daily." },
    { n: "Aerius 5mg", sku: "SPH-AE-032", cat: "allergy", brand: "Organon", pack: "10 tablets", price: 690, compare: 780, stock: "LOW_STOCK", qty: 6, img: "/images/products/aerius-tablets.webp", desc: "Desloratadine long-acting non-drowsy allergy relief.", usage: "Adults: 1 tablet daily with or without food." },
    // Vitamins & supplements
    { n: "Centrum Adults", sku: "SPH-CE-040", cat: "vitamins", brand: "Pfizer", pack: "30 tablets", price: 1450, compare: 1700, stock: "IN_STOCK", qty: 48, img: "/images/products/multivitamin-tablets.webp", desc: "Complete daily multivitamin with 24 key micronutrients for adults.", usage: "1 tablet daily with food." },
    { n: "Ferrous Sulphate + Folic", sku: "SPH-FS-041", cat: "vitamins", brand: "Generic", pack: "60 tablets", price: 320, stock: "IN_STOCK", qty: 120, img: "/images/products/iron-tablets.webp", desc: "Iron and folic acid supplement for anaemia support and pregnancy.", usage: "1 tablet daily after food. Avoid taking with tea/coffee." },
    { n: "Vitamin C 1000mg Effervescent", sku: "SPH-VC-042", cat: "vitamins", brand: "Generic", pack: "20 tablets", price: 550, stock: "IN_STOCK", qty: 90, img: "/images/products/vitamin-c-effervescent.webp", desc: "High-strength immune support effervescent tablets with zinc.", usage: "Dissolve 1 tablet in water daily." },
    { n: "Omega-3 Fish Oil 1000mg", sku: "SPH-OM-043", cat: "vitamins", brand: "Nature's Bounty", pack: "60 softgels", price: 1850, stock: "OUT_OF_STOCK", qty: 0, img: "/images/products/omega3-softgels.webp", desc: "Heart and brain health support with EPA and DHA omega-3 fatty acids.", usage: "2 softgels daily with meals." },
    { n: "Calcium + Vitamin D3", sku: "SPH-CA-044", cat: "vitamins", brand: "Generic", pack: "60 tablets", price: 750, stock: "IN_STOCK", qty: 75, img: "/images/products/calcium-tablets.webp", desc: "Bone health support with calcium carbonate 600mg and vitamin D3 400IU.", usage: "1 tablet twice daily with food." },
    // Mother & baby
    { n: "Pampers Baby-Dry Size 3", sku: "SPH-PA-050", cat: "mother-baby", brand: "P&G", pack: "42 nappies", price: 1299, compare: 1499, stock: "IN_STOCK", qty: 40, img: "/images/products/baby-nappies.webp", desc: "Ultra-absorbent disposable nappies for babies 7–12kg with 12-hour dryness." },
    { n: "Cerelac Wheat & Honey 400g", sku: "SPH-CR-051", cat: "mother-baby", brand: "Nestlé", pack: "400g tin", price: 620, stock: "IN_STOCK", qty: 55, img: "/images/products/baby-cereal.webp", desc: "Iron-fortified infant cereal for babies from 6 months." },
    { n: "Bonnisan Syrup 100ml", sku: "SPH-BO-052", cat: "mother-baby", brand: "Himalaya", pack: "100ml", price: 480, stock: "IN_STOCK", qty: 36, img: "/images/products/baby-digestive-syrup.webp", desc: "Ayurvedic digestive tonic for infants — gripe relief and appetite support.", usage: "As per age guidance on pack. Shake well before use." },
    { n: "Aptamil Profutura 1 400g", sku: "SPH-AP-053", cat: "mother-baby", brand: "Danone", pack: "400g tin", price: 1250, stock: "LOW_STOCK", qty: 5, img: "/images/products/infant-formula.webp", desc: "First infant milk formula from birth for combination or bottle feeding.", warn: "Breastfeeding is best for babies. Follow preparation instructions exactly." },
    // Personal care
    { n: "Dettol Antiseptic 250ml", sku: "SPH-DE-060", cat: "personal-care", brand: "RB", pack: "250ml", price: 340, stock: "IN_STOCK", qty: 100, img: "/images/products/antiseptic-liquid.webp", desc: "Chloroxylenol antiseptic liquid for first aid, personal hygiene and home disinfection.", usage: "Dilute 1 capful in water for wound cleansing." },
    { n: "Sensodyne Fresh Impact", sku: "SPH-SE-061", cat: "personal-care", brand: "GSK", pack: "75ml", price: 480, stock: "IN_STOCK", qty: 85, img: "/images/products/toothpaste.webp", desc: "Daily fluoride toothpaste for sensitive teeth with lasting sensitivity protection." },
    { n: "Johnson's Baby Oil 125ml", sku: "SPH-JB-062", cat: "personal-care", brand: "J&J", pack: "125ml", price: 390, stock: "IN_STOCK", qty: 70, img: "/images/products/baby-oil.webp", desc: "Pure mineral baby oil for massage and moisturising delicate skin." },
    { n: "Safeguard Soap 4-Pack", sku: "SPH-SG-063", cat: "personal-care", brand: "P&G", pack: "4 × 110g bars", price: 320, stock: "IN_STOCK", qty: 150, img: "/images/products/soap-bars.webp", desc: "Antibacterial bar soap for family hand and body washing." },
    // Skin care
    { n: "Cetaphil Gentle Cleanser 250ml", sku: "SPH-CT-070", cat: "skin-care", brand: "Galderma", pack: "250ml", price: 1650, compare: 1900, stock: "IN_STOCK", qty: 30, img: "/images/products/facial-cleanser.webp", desc: "Soap-free cleanser for sensitive, normal and combination skin." },
    { n: "Canesten Cream 1%", sku: "SPH-CA-071", cat: "skin-care", brand: "Bayer", pack: "20g", price: 650, stock: "IN_STOCK", qty: 44, img: "/images/products/antifungal-cream.webp", desc: "Clotrimazole antifungal cream for athlete's foot, ringworm and fungal skin infections.", usage: "Apply thinly 2–3 times daily to affected area. Continue for 2 weeks after symptoms clear." },
    { n: "Hydrocortisone Cream 1%", sku: "SPH-HC-072", cat: "skin-care", brand: "Generic", pack: "15g", price: 280, rx: true, stock: "IN_STOCK", qty: 38, img: "/images/products/hydrocortisone-cream.webp", desc: "Mild corticosteroid cream for eczema, dermatitis and insect bite inflammation.", warn: "Prescription-only. Do not use on the face or on broken skin for prolonged periods.", usage: "Apply thinly once or twice daily for up to 7 days." },
    { n: "Nivea Soft Cream 200ml", sku: "SPH-NI-073", cat: "skin-care", brand: "Beiersdorf", pack: "200ml", price: 720, stock: "IN_STOCK", qty: 60, img: "/images/products/moisturising-cream.webp", desc: "Light moisturising cream with jojoba oil and vitamin E for face and body." },
    // Sexual & reproductive health
    { n: "Durex Extra Safe 12-Pack", sku: "SPH-DU-080", cat: "sexual-health", brand: "Durex", pack: "12 condoms", price: 560, stock: "IN_STOCK", qty: 90, img: "/images/products/condoms.webp", desc: "Latex condoms with extra lubrication for reliable protection." },
    { n: "Femiplan Contraceptive Pills", sku: "SPH-FE-081", cat: "sexual-health", brand: "Femiplan", pack: "28 tablets", price: 550, rx: true, stock: "IN_STOCK", qty: 40, img: "/images/products/contraceptive-pills.webp", desc: "Combined oral contraceptive pills for pregnancy prevention.", warn: "Prescription-only. Requires pharmacist review and blood pressure check discussion.", usage: "1 tablet daily at the same time." },
    { n: "Pregnancy Test Strips (5)", sku: "SPH-PT-082", cat: "diagnostics", brand: "Generic", pack: "5 test strips", price: 350, stock: "IN_STOCK", qty: 65, img: "/images/products/pregnancy-test.webp", desc: "Rapid hCG urine pregnancy test strips with 99% accuracy." },
    // Diabetes
    { n: "Accu-Chek Active Strips (50)", sku: "SPH-AC-090", cat: "diabetes", brand: "Roche", pack: "50 strips", price: 2100, stock: "IN_STOCK", qty: 25, img: "/images/products/glucose-strips.webp", desc: "Glucose test strips for use with Accu-Chek Active meter." },
    { n: "Accu-Chek Softclix Lancets (100)", sku: "SPH-AL-091", cat: "diabetes", brand: "Roche", pack: "100 lancets", price: 1150, stock: "IN_STOCK", qty: 40, img: "/images/products/lancets.webp", desc: "Sterile lancets for fingertip blood sampling." },
    { n: "Metformin 500mg", sku: "SPH-ME-092", cat: "prescription", brand: "Generic", pack: "60 tablets", price: 350, rx: true, stock: "IN_STOCK", qty: 100, img: "/images/products/metformin-tablets.webp", desc: "First-line oral medicine for type 2 diabetes management.", warn: "Prescription-only. Take with meals to reduce stomach upset.", usage: "As prescribed — typically 1 tablet twice daily with food." },
    { n: "Amlodipine 5mg", sku: "SPH-AM-093", cat: "heart-health", brand: "Generic", pack: "30 tablets", price: 220, rx: true, stock: "IN_STOCK", qty: 85, img: "/images/products/bp-tablets.webp", desc: "Calcium channel blocker for high blood pressure and angina.", warn: "Prescription-only. Do not stop suddenly.", usage: "As prescribed — typically 1 tablet once daily." },
    // Blood pressure / heart
    { n: "Omron M2 BP Monitor", sku: "SPH-BM-100", cat: "medical-devices", brand: "Omron", pack: "Standard kit", price: 4500, compare: 5200, stock: "IN_STOCK", qty: 12, img: "/images/products/bp-monitor.webp", desc: "Automatic upper-arm blood pressure monitor with IntelliSense technology and cuff." },
    { n: "Coenzyme Q10 100mg", sku: "SPH-CQ-101", cat: "heart-health", brand: "Solgar", pack: "30 capsules", price: 2400, stock: "LOW_STOCK", qty: 6, img: "/images/products/coq10-capsules.webp", desc: "Antioxidant coenzyme for heart health and cellular energy support." },
    // First aid
    { n: "Elastoplast Plasters (40)", sku: "SPH-EL-110", cat: "first-aid", brand: "Beiersdorf", pack: "40 plasters", price: 350, stock: "IN_STOCK", qty: 200, img: "/images/products/plasters.webp", desc: "Breathable fabric plasters in assorted sizes with non-stick wound pads." },
    { n: "Crepe Bandage 10cm", sku: "SPH-CB-111", cat: "first-aid", brand: "Generic", pack: "1 roll", price: 180, stock: "IN_STOCK", qty: 120, img: "/images/products/crepe-bandage.webp", desc: "Elastic support bandage for sprains, strains and compression." },
    { n: "First Aid Kit (Family)", sku: "SPH-FA-112", cat: "first-aid", brand: "Sphere", pack: "1 kit", price: 2200, compare: 2600, stock: "IN_STOCK", qty: 15, img: "/images/products/first-aid-kit.webp", desc: "Complete family first-aid kit with plasters, gauze, antiseptic, bandages, burn gel and gloves." },
    { n: "Malaria Test Kit (RDT)", sku: "SPH-ML-113", cat: "diagnostics", brand: "Generic", pack: "1 test kit", price: 200, stock: "IN_STOCK", qty: 150, img: "/images/products/malaria-test-kit.webp", desc: "Rapid malaria Pf/Pv antigen test — results in 15 minutes." },
    // Devices / diagnostics
    { n: "Digital Thermometer", sku: "SPH-DT-120", cat: "medical-devices", brand: "Generic", pack: "1 unit", price: 450, stock: "IN_STOCK", qty: 60, img: "/images/products/thermometer.webp", desc: "Fast, accurate digital thermometer with fever alert and memory." },
    { n: "Glucometer Kit + 10 Strips", sku: "SPH-GK-121", cat: "diabetes", brand: "Accu-Chek", pack: "1 kit", price: 2800, compare: 3300, stock: "IN_STOCK", qty: 18, img: "/images/products/glucometer-kit.webp", desc: "Complete blood glucose monitoring starter kit with meter, lancing device and 10 strips." },
    { n: "Pulse Oximeter Fingertip", sku: "SPH-PO-122", cat: "medical-devices", brand: "Generic", pack: "1 unit", price: 1900, stock: "IN_STOCK", qty: 22, img: "/images/products/pulse-oximeter.webp", desc: "Fingertip pulse oximeter measuring SpO2 and pulse rate with OLED display." },
    { n: "Face Masks (50-Pack)", sku: "SPH-FM-123", cat: "personal-care", brand: "Generic", pack: "50 masks", price: 650, stock: "IN_STOCK", qty: 80, img: "/images/products/face-masks.webp", desc: "3-ply disposable protective face masks with ear loops." },
    { n: "Hand Sanitiser 500ml", sku: "SPH-HS-124", cat: "personal-care", brand: "Sphere", pack: "500ml", price: 450, compare: 550, stock: "IN_STOCK", qty: 110, img: "/images/products/hand-sanitiser.webp", desc: "70% alcohol gel hand sanitiser with aloe and glycerin." },
    // A few more RX items for the queue
    { n: "Amoxicillin 500mg Capsules", sku: "SPH-AMX-130", cat: "prescription", brand: "Generic", pack: "21 capsules", price: 380, rx: true, stock: "IN_STOCK", qty: 90, img: "/images/products/antibiotic-capsules.webp", desc: "Broad-spectrum penicillin antibiotic for bacterial infections.", warn: "Prescription-only. Complete the full course as prescribed.", usage: "1 capsule 3 times daily, or as prescribed." },
    { n: "Azithromycin 500mg", sku: "SPH-AZ-131", cat: "prescription", brand: "Generic", pack: "3 tablets", price: 480, rx: true, stock: "IN_STOCK", qty: 60, img: "/images/products/azithromycin-tablets.webp", desc: "Macrolide antibiotic for respiratory, skin and other infections.", warn: "Prescription-only. Pharmacist verification required.", usage: "As prescribed — commonly 1 tablet daily for 3 days." },
    { n: "Metronidazole 400mg", sku: "SPH-MT-132", cat: "prescription", brand: "Generic", pack: "15 tablets", price: 250, rx: true, stock: "IN_STOCK", qty: 75, img: "/images/products/metronidazole-tablets.webp", desc: "Antibacterial and antiprotozoal for dental, gut and other anaerobic infections.", warn: "Prescription-only. Avoid alcohol during and 48h after treatment.", usage: "As prescribed — commonly 1 tablet 3 times daily." },
    { n: "Co-amoxiclav 625mg", sku: "SPH-CV-133", cat: "prescription", brand: "Generic", pack: "14 tablets", price: 680, rx: true, stock: "LOW_STOCK", qty: 4, img: "/images/products/co-amoxiclav-tablets.webp", desc: "Amoxicillin with clavulanic acid for resistant bacterial infections.", warn: "Prescription-only. Take with food to reduce stomach upset." },
    { n: "Omeprazole 20mg", sku: "SPH-OMZ-134", cat: "prescription", brand: "Generic", pack: "14 capsules", price: 420, rx: true, stock: "IN_STOCK", qty: 110, img: "/images/products/omeprazole-capsules.webp", desc: "Proton pump inhibitor for acid reflux, gastritis and ulcers.", warn: "Prescription-only for long-term use.", usage: "1 capsule daily before breakfast, or as prescribed." },
    { n: "Salbutamol Syrup 100ml", sku: "SPH-SS-135", cat: "prescription", brand: "Generic", pack: "100ml", price: 320, rx: true, stock: "IN_STOCK", qty: 30, img: "/images/products/oral-syrup.webp", desc: "Oral bronchodilator syrup for children with asthma/reversible airway disease.", warn: "Prescription-only." },
    // General OTC Medicines (pharmacy-counter essentials)
    { n: "Paracetamol 500mg (Generic)", sku: "SPH-PC-140", cat: "otc", brand: "Dawa", pack: "100 tablets", price: 120, compare: 150, stock: "IN_STOCK", qty: 500, img: "/images/products/generic-paracetamol.webp", desc: "Kenya's everyday pain and fever essential — paracetamol 500mg tablets for the whole family.", usage: "Adults: 1–2 tablets every 4–6 hours. Max 8 in 24 hours.", warn: "Do not combine with other paracetamol-containing products." },
    { n: "Piriton 4mg (Chlorpheniramine)", sku: "SPH-PI-141", cat: "otc", brand: "GSK", pack: "100 tablets", price: 180, stock: "IN_STOCK", qty: 180, img: "/images/products/piriton-tablets.webp", desc: "Classic antihistamine for allergies, itching and night-time cold relief.", usage: "Adults: 1 tablet up to 4 times daily.", warn: "May cause drowsiness — avoid driving." },
    { n: "Cough Linctus Honey 100ml", sku: "SPH-CL-142", cat: "otc", brand: "Generic", pack: "100ml", price: 260, stock: "IN_STOCK", qty: 95, img: "/images/products/cough-syrup.webp", desc: "Soothing honey-based cough linctus for dry, irritating coughs.", usage: "Adults: 10ml 3–4 times daily. Children 6–12: 5ml." },
    { n: "Magnesium Trisilicate Mixture", sku: "SPH-MT-143", cat: "otc", brand: "Generic", pack: "200ml", price: 190, stock: "IN_STOCK", qty: 110, img: "/images/products/mixture-bottle.webp", desc: "Fast heartburn and indigestion relief mixture, ideal after heavy meals.", usage: "10ml after meals and at bedtime, or as needed." },
    { n: "Zincovit Multivitamin Tablets", sku: "SPH-ZN-144", cat: "otc", brand: "Apex", pack: "30 tablets", price: 480, compare: 560, stock: "IN_STOCK", qty: 88, img: "/images/products/multivitamin-bottle.webp", desc: "Daily multivitamin with zinc, ideal for recovery after illness and immune support.", usage: "1 tablet daily after food." },
    { n: "Volini Pain Relief Spray", sku: "SPH-VS-145", cat: "otc", brand: "Sun Pharma", pack: "60g", price: 590, stock: "LOW_STOCK", qty: 5, img: "/images/products/pain-spray.webp", desc: "Topical analgesic spray for instant relief of muscle pain, stiffness and sports injuries.", usage: "Spray on the affected area 2–3 times daily." },
  ]

  for (const p of products) {
    await db.product.create({
      data: {
        name: p.n,
        sku: p.sku,
        categoryId: catMap[p.cat],
        brand: p.brand,
        packSize: p.pack,
        price: p.price,
        compareAtPrice: p.compare ?? null,
        requiresPrescription: p.rx ?? false,
        stockStatus: p.stock,
        stockQty: p.qty,
        description: p.desc,
        usageInfo: p.usage ?? null,
        warnings: p.warn ?? null,
        image: p.img,
      },
    })
  }
  console.log(`${products.length} products seeded`)

  // ---------- Promotions ----------
  await db.promotion.createMany({
    data: [
      {
        title: "Vitamin C month — 15% off",
        description: "Immunity boosters from KSh 467. Offer on selected vitamins & supplements this month.",
        badge: "15% OFF",
        code: "VITC15",
        discountPct: 15,
        color: "amber",
      },
      {
        title: "Free delivery within Roysambu",
        description: "Orders over KSh 3,000 delivered free within Roysambu / TRM area.",
        badge: "FREE DELIVERY",
        color: "teal",
      },
      {
        title: "Family First Aid Kit — KSh 2,200",
        description: "Complete kit for homes and cars. Was KSh 2,600.",
        badge: "SAVE 400",
        color: "rose",
      },
      {
        title: "Welcome offer — 10% off your first order",
        description: "New customers save 10% on any OTC order over KSh 1,000. Use code SAVE10 at checkout.",
        badge: "10% OFF",
        code: "SAVE10",
        discountPct: 10,
        color: "emerald",
      },
    ],
  })
  console.log("promotions seeded")

  // ---------- Demo customers ----------
  const customer = await db.user.create({
    data: {
      name: "Amina Wanjiru",
      phone: "+254712000001",
      email: "customer@spherepharmacy.co.ke",
      passwordHash: hashPassword("customer123"),
    },
  })
  const customer2 = await db.user.create({
    data: {
      name: "David Kimani",
      phone: "+254712000002",
      email: "david@example.com",
      passwordHash: hashPassword("customer123"),
    },
  })
  await db.user.create({
    data: { name: "Grace Achieng", phone: "+254712000003", passwordHash: hashPassword("customer123") },
  })
  await db.notificationPref.create({ data: { userId: customer.id, sms: true, whatsapp: true, email: true } })
  await db.notificationPref.create({ data: { userId: customer2.id, sms: true, whatsapp: true } })
  await db.address.create({
    data: { userId: customer.id, label: "Home", text: "Apt 4B, Sunrise Court, Lumumba Drive", area: "Roysambu / TRM area", isDefault: true },
  })
  await db.address.create({
    data: { userId: customer2.id, label: "Home", text: "House 22, Kasarani Mwiki Road", area: "Kasarani", isDefault: true },
  })

  const grace = await db.user.findUnique({ where: { phone: "+254712000003" } })

  // helper to find product ids (used by reviews + orders)
  const pid = async (sku: string) => (await db.product.findUnique({ where: { sku } }))!.id
  const pName = async (sku: string) => (await db.product.findUnique({ where: { sku } }))!.name

  // ---------- Product reviews (ratings & social proof) ----------
  const reviewData: [string, string, number, string][] = [ // sku, userId, rating, comment
    ["SPH-PE-001", customer.id, 5, "Works fast for my migraines. Delivery took under two hours — very impressed."],
    ["SPH-PE-001", customer2.id, 4, "Reliable painkiller. Packaging arrived sealed and with a long expiry date."],
    ["SPH-OR-021", customer.id, 5, "Doctor recommended ORS for my son during a stomach bug — the WHO sachets worked great."],
    ["SPH-CE-040", grace!.id, 4, "Good value for a 30-day supply. Capsules are easy to swallow."],
    ["SPH-VC-042", customer2.id, 5, "The whole family takes one daily. Dissolves fast and tastes fine."],
    ["SPH-DE-060", customer.id, 4, "The classic antiseptic — always keep a bottle at home."],
    ["SPH-ST-012", grace!.id, 5, "Sore throat gone in two days. Honey & lemon flavour is pleasant."],
    ["SPH-PA-050", customer2.id, 4, "Genuine Pampers at a fair price. Overnight dryness holds up."],
    ["SPH-CT-070", grace!.id, 5, "Perfect for my sensitive skin — no irritation at all, worth the price."],
    ["SPH-BM-100", customer.id, 5, "Accurate readings, easy to use. The pharmacist walked me through the cuff size."],
    ["SPH-PC-140", customer2.id, 5, "Same paracetamol as the big brands at less than half the price."],
    ["SPH-FA-112", grace!.id, 4, "Well-stocked kit — everything a family needs for minor emergencies."],
  ]
  for (const [sku, userId, rating, comment] of reviewData) {
    await db.review.create({
      data: { productId: await pid(sku), userId, rating, comment },
    })
  }
  // one moderated (hidden) review — demonstrates review moderation in admin
  await db.review.create({
    data: {
      productId: await pid("SPH-PA-050"),
      userId: customer.id,
      rating: 1,
      comment: "Contains personal medical details — shared at checkout. Staff please hide this.",
      status: "HIDDEN",
    },
  })
  console.log("reviews seeded")

  // ---------- Back-in-stock alert demo ----------
  await db.productAlert.create({
    data: { productId: await pid("SPH-OM-043"), userId: customer.id },
  })
  console.log("customers seeded")

  // ---------- Demo orders ----------
  const now = Date.now()
  const hour = 3600_000
  const day = 24 * hour

  async function seedOrder(opts: {
    user: string
    type: string
    status: string
    fulfillment: string
    items: { id: string; name: string; price: number; qty: number; rx?: boolean }[]
    history: [string, number, string, string][] // status, hoursAgo, actor, note
    payment?: { provider: string; method: string; status: string; amount: number; ref?: string; phone?: string; cardLast4?: string }
    fee?: number
    address?: string
    area?: string
    rider?: { id: string; name: string } // assigned delivery rider
    pointsEarned?: number
    pointsRedeemed?: number
    discountAmount?: number
    promotionCode?: string
  }) {
    const subtotal = opts.items.reduce((s, i) => s + i.price * i.qty, 0)
    const fee = opts.fee ?? 0
    const discount = opts.discountAmount ?? 0
    const total = subtotal - discount + fee
    const order = await db.order.create({
      data: {
        reference: orderReference(),
        userId: opts.user,
        type: opts.type,
        status: opts.status,
        fulfillment: opts.fulfillment,
        deliveryAddress: opts.address,
        deliveryArea: opts.area,
        deliveryFee: fee,
        subtotal,
        discountAmount: discount,
        promotionCode: opts.promotionCode ?? null,
        total,
        pointsEarned: opts.pointsEarned ?? 0,
        pointsRedeemed: opts.pointsRedeemed ?? 0,
        riderId: opts.rider?.id ?? null,
        riderName: opts.rider?.name ?? null,
        pickupCode: opts.fulfillment === "PICKUP" ? pickupCode() : null,
        createdAt: new Date(now - (opts.history[0]?.[1] ?? 1) * hour - 30 * 60_000),
      },
    })
    for (const i of opts.items) {
      await db.orderItem.create({
        data: {
          orderId: order.id,
          productId: i.id,
          name: i.name,
          price: i.price,
          qty: i.qty,
          requiresPrescription: i.rx ?? false,
          lineTotal: i.price * i.qty,
        },
      })
    }
    for (const [status, hoursAgo, actor, note] of opts.history) {
      await db.orderStatusHistory.create({
        data: { orderId: order.id, status, actor, note, createdAt: new Date(now - hoursAgo * hour) },
      })
    }
    if (opts.payment) {
      const { ref, ...rest } = opts.payment
      await db.payment.create({ data: { ...rest, orderId: order.id, providerReference: ref ?? null } })
    }
    return order
  }

  // 1. Delivered OTC order (paid M-Pesa) — 3 days ago
  await seedOrder({
    user: customer.id,
    type: "OTC",
    status: "COMPLETED_DELIVERY",
    fulfillment: "DELIVERY",
    items: [
      { id: await pid("SPH-PE-001"), name: await pName("SPH-PE-001"), price: 250, qty: 2 },
      { id: await pid("SPH-OR-021"), name: await pName("SPH-OR-021"), price: 150, qty: 1 },
    ],
    history: [
      ["RECEIVED", 72, "System", "Order received"],
      ["AVAILABILITY_CONFIRMED", 71.5, "Brian Otieno", "All items in stock"],
      ["AWAITING_PAYMENT", 71.4, "System", "M-Pesa prompt sent"],
      ["PAID", 71.2, "System", "M-Pesa payment confirmed"],
      ["PREPARING", 70.5, "Brian Otieno", "Order being prepared"],
      ["OUT_FOR_DELIVERY", 69, "Kevin Mwangi", "Rider dispatched"],
      ["COMPLETED_DELIVERY", 68, "Kevin Mwangi", "Delivered to customer"],
    ],
    payment: { provider: "MPESA", method: "STK_PUSH", status: "SUCCESS", amount: 750, ref: "QGH7X2M9PK" },
    fee: 150,
    address: "Apt 4B, Sunrise Court, Lumumba Drive",
    area: "Roysambu / TRM area",
    rider: { id: rider.id, name: rider.name },
    pointsEarned: 7,
  })

  // 2. Active order awaiting payment (OTC, delivery)
  await seedOrder({
    user: customer2.id,
    type: "OTC",
    status: "AWAITING_PAYMENT",
    fulfillment: "DELIVERY",
    items: [
      { id: await pid("SPH-CQ-101"), name: await pName("SPH-CQ-101"), price: 2400, qty: 1 },
      { id: await pid("SPH-VC-042"), name: await pName("SPH-VC-042"), price: 550, qty: 2 },
    ],
    history: [
      ["RECEIVED", 5, "System", "Order received"],
      ["AVAILABILITY_CONFIRMED", 4.7, "Brian Otieno", "All items in stock"],
      ["AWAITING_PAYMENT", 4.5, "System", "Awaiting customer payment"],
    ],
    fee: 150,
    address: "House 22, Kasarani Mwiki Road",
    area: "Kasarani",
  })

  // 3. Prescription order under review
  const rxOrder = await seedOrder({
    user: customer.id,
    type: "PRESCRIPTION",
    status: "UNDER_REVIEW",
    fulfillment: "PICKUP",
    items: [{ id: await pid("SPH-AMX-130"), name: await pName("SPH-AMX-130"), price: 380, qty: 1, rx: true }],
    history: [
      ["RECEIVED", 26, "System", "Prescription order received"],
      ["UNDER_REVIEW", 25.8, "System", "Prescription uploaded — queued for pharmacist review"],
    ],
  })

  // 4. Ready for pickup (paid card)
  await seedOrder({
    user: customer2.id,
    type: "OTC",
    status: "READY_FOR_PICKUP",
    fulfillment: "PICKUP",
    items: [{ id: await pid("SPH-BM-100"), name: await pName("SPH-BM-100"), price: 4500, qty: 1 }],
    history: [
      ["RECEIVED", 30, "System", "Order received"],
      ["AVAILABILITY_CONFIRMED", 29.8, "Brian Otieno", "Item in stock"],
      ["AWAITING_PAYMENT", 29.5, "System", "Payment link sent"],
      ["PAID", 29.2, "System", "Card payment confirmed"],
      ["PREPARING", 28, "Brian Otieno", "Being prepared"],
      ["READY_FOR_PICKUP", 27, "Brian Otieno", "Ready — collect at counter with your code"],
    ],
    payment: { provider: "INTASEND", method: "CARD", status: "SUCCESS", amount: 4500, ref: "INT-88213", cardLast4: "4242" },
    pointsEarned: 45,
  })

  // 5. Recent completed pickup with M-Pesa
  await seedOrder({
    user: customer.id,
    type: "OTC",
    status: "COMPLETED_PICKUP",
    fulfillment: "PICKUP",
    items: [
      { id: await pid("SPH-ST-012"), name: await pName("SPH-ST-012"), price: 190, qty: 1 },
      { id: await pid("SPH-AF-010"), name: await pName("SPH-AF-010"), price: 350, qty: 1 },
    ],
    history: [
      ["RECEIVED", 50, "System", "Order received"],
      ["AVAILABILITY_CONFIRMED", 49.8, "Brian Otieno", "All items in stock"],
      ["AWAITING_PAYMENT", 49.5, "System", "M-Pesa prompt sent"],
      ["PAID", 49.2, "System", "M-Pesa payment confirmed"],
      ["PREPARING", 49, "Brian Otieno", "Being prepared"],
      ["READY_FOR_PICKUP", 48, "Brian Otieno", "Ready for collection"],
      ["COMPLETED_PICKUP", 47, "Brian Otieno", "Collected at counter"],
    ],
    payment: { provider: "MPESA", method: "STK_PUSH", status: "SUCCESS", amount: 540, ref: "QL91Z4X8" },
    pointsEarned: 5,
  })

  // 6. Reservation order (pay in store) — awaiting pickup
  await seedOrder({
    user: customer.id,
    type: "RESERVATION",
    status: "READY_FOR_PICKUP",
    fulfillment: "PICKUP",
    items: [{ id: await pid("SPH-FA-112"), name: await pName("SPH-FA-112"), price: 2200, qty: 1 }],
    history: [
      ["RECEIVED", 8, "System", "Reservation received"],
      ["AVAILABILITY_CONFIRMED", 7.8, "Brian Otieno", "Item reserved"],
      ["AWAITING_PAYMENT", 7.5, "System", "Pay on pickup selected"],
      ["PREPARING", 7, "Brian Otieno", "Being prepared"],
      ["READY_FOR_PICKUP", 6.5, "Brian Otieno", "Reserved — pay & collect at counter"],
    ],
  })

  // 7. Past prescription order (approved + delivered)
  const pastRxOrder = await seedOrder({
    user: customer2.id,
    type: "PRESCRIPTION",
    status: "COMPLETED_DELIVERY",
    fulfillment: "DELIVERY",
    items: [{ id: await pid("SPH-ME-092"), name: await pName("SPH-ME-092"), price: 350, qty: 2, rx: true }],
    history: [
      ["RECEIVED", 120, "System", "Prescription order received"],
      ["UNDER_REVIEW", 119.9, "System", "Prescription queued for review"],
      ["PRESCRIPTION_VERIFIED", 119, "Hilda Khasaya", "Prescription verified"],
      ["AVAILABILITY_CONFIRMED", 118.8, "Brian Otieno", "Items in stock"],
      ["AWAITING_PAYMENT", 118.5, "System", "M-Pesa prompt sent"],
      ["PAID", 118, "System", "M-Pesa payment confirmed"],
      ["PREPARING", 117, "Brian Otieno", "Being prepared"],
      ["OUT_FOR_DELIVERY", 116, "Kevin Mwangi", "Rider dispatched"],
      ["COMPLETED_DELIVERY", 115, "Kevin Mwangi", "Delivered to customer"],
    ],
    payment: { provider: "MPESA", method: "STK_PUSH", status: "SUCCESS", amount: 850, ref: "QK44LMP2" },
    fee: 200,
    address: "House 22, Kasarani Mwiki Road",
    area: "Kasarani",
    rider: { id: rider.id, name: rider.name },
    pointsEarned: 8,
  })

  // 8. Dispatch-ready delivery (paid, assigned rider, preparing) — dispatch board demo
  await seedOrder({
    user: customer.id,
    type: "OTC",
    status: "PREPARING",
    fulfillment: "DELIVERY",
    items: [
      { id: await pid("SPH-VC-042"), name: await pName("SPH-VC-042"), price: 550, qty: 2 },
      { id: await pid("SPH-DE-060"), name: await pName("SPH-DE-060"), price: 320, qty: 1 },
    ],
    history: [
      ["RECEIVED", 6, "System", "Order received"],
      ["AVAILABILITY_CONFIRMED", 5.8, "Brian Otieno", "All items in stock"],
      ["AWAITING_PAYMENT", 5.5, "System", "M-Pesa prompt sent"],
      ["PAID", 5.2, "System", "M-Pesa payment confirmed"],
      ["PREPARING", 4.5, "Brian Otieno", "Being prepared for dispatch"],
    ],
    payment: { provider: "MPESA", method: "STK_PUSH", status: "SUCCESS", amount: 1610, ref: "QRT93KZ1" },
    fee: 150,
    address: "Apt 4B, Sunrise Court, Lumumba Drive",
    area: "Roysambu / TRM area",
    rider: { id: rider.id, name: rider.name },
  })

  // 9. Out for delivery (rider active trip) — rider board demo
  await seedOrder({
    user: grace!.id,
    type: "MIXED",
    status: "OUT_FOR_DELIVERY",
    fulfillment: "DELIVERY",
    items: [
      { id: await pid("SPH-PE-001"), name: await pName("SPH-PE-001"), price: 250, qty: 1 },
      { id: await pid("SPH-ME-092"), name: await pName("SPH-ME-092"), price: 350, qty: 1, rx: true },
    ],
    history: [
      ["RECEIVED", 20, "System", "Order received"],
      ["UNDER_REVIEW", 19.9, "System", "Prescription queued for review"],
      ["PRESCRIPTION_VERIFIED", 19, "Hilda Khasaya", "Prescription verified"],
      ["AVAILABILITY_CONFIRMED", 18.8, "Brian Otieno", "Items in stock"],
      ["AWAITING_PAYMENT", 18.5, "System", "M-Pesa prompt sent"],
      ["PAID", 18, "System", "M-Pesa payment confirmed"],
      ["PREPARING", 3, "Brian Otieno", "Being prepared"],
      ["OUT_FOR_DELIVERY", 1.5, "Kevin Mwangi", "Rider dispatched — on the way"],
    ],
    payment: { provider: "MPESA", method: "STK_PUSH", status: "SUCCESS", amount: 920, ref: "QMX77BV4" },
    fee: 200,
    address: "Flat 9, Githurai 44 Apartments, Thika Road",
    area: "Githurai 44",
    rider: { id: rider.id, name: rider.name },
  })
  // ---------- Sphere Points balances (incl. legacy in-store activity) ----------
  await db.user.update({ where: { id: customer.id }, data: { loyaltyPoints: 620 } })
  await db.user.update({ where: { id: customer2.id }, data: { loyaltyPoints: 340 } })

  // ---------- Demo prescriptions ----------
  // tiny 1x1 placeholder PNG as base64 for demo uploads
  const demoRxPng =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
  await db.prescription.create({
    data: {
      userId: customer.id,
      orderId: rxOrder.id,
      fileName: "amoxicillin-rx.png",
      fileType: "image/png",
      fileData: demoRxPng,
      notes: "From Nairobi West Hospital — Dr. Otieno, dated this week.",
      status: "PENDING",
    },
  })
  await db.prescription.create({
    data: {
      userId: customer2.id,
      orderId: pastRxOrder.id,
      fileName: "metformin-rx.pdf",
      fileType: "application/pdf",
      fileData: demoRxPng,
      notes: "Repeat prescription from Kenyatta National Hospital.",
      status: "APPROVED",
      reviewedById: pharmacist.id,
      reviewNotes: "Verified — 2-month repeat dispensed. Next refill due in 8 weeks.",
      reviewedAt: new Date(now - 119 * hour),
      refillsAllowed: 2,
      refillsUsed: 1,
      validUntil: new Date(now + 90 * day),
    },
  })
  console.log("prescriptions seeded")

  // ---------- Notifications for demo customer ----------
  await db.notification.createMany({
    data: [
      {
        userId: customer.id,
        channel: "IN_APP",
        event: "ORDER_STATUS",
        title: "Order ready for pickup",
        message: "Your reservation SPH is ready — show your pickup code at the counter and pay there.",
      },
      {
        userId: customer.id,
        channel: "WHATSAPP",
        event: "PRESCRIPTION",
        title: "Prescription received",
        message: "We received your prescription. Our pharmacist is reviewing it — usually within 2 working hours.",
      },
      {
        userId: customer.id,
        channel: "IN_APP",
        event: "PROMOTION",
        title: "Vitamin C month",
        message: "Selected vitamins are 15% off this month. Ask us for details on your next pickup!",
      },
    ],
  })

  // ---------- Audit logs ----------
  await db.auditLog.createMany({
    data: [
      {
        actor: "Sphere Admin",
        actorRole: "ADMIN",
        action: "PRICE_UPDATE",
        entity: "Product",
        entityId: "SPH-VC-042",
        details: "Price changed from KSh 620 to KSh 550",
        createdAt: new Date(now - 3 * day),
      },
      {
        actor: "Hilda Khasaya",
        actorRole: "PHARMACIST",
        action: "PRESCRIPTION_APPROVED",
        entity: "Prescription",
        createdAt: new Date(now - 119 * hour),
      },
      {
        actor: "Brian Otieno",
        actorRole: "STAFF",
        action: "STOCK_UPDATE",
        entity: "Product",
        entityId: "SPH-OM-043",
        details: "Stock status set to OUT_OF_STOCK",
        createdAt: new Date(now - 2 * day),
      },
    ],
  })

  console.log("Seed complete")
  console.log("Staff logins:")
  console.log("  admin@spherepharmacy.co.ke / admin123")
  console.log("  pharmacist@spherepharmacy.co.ke / pharm123")
  console.log("  staff@spherepharmacy.co.ke / staff123")
  console.log("  rider@spherepharmacy.co.ke / rider123")
  console.log("Customer login: customer@spherepharmacy.co.ke / customer123")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
