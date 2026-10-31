import { PrismaClient } from "@prisma/client"
import { hashPassword } from "../src/lib/hash"

const prisma = new PrismaClient()

async function main() {
  console.log("Seeding Medivyx database...")

  // 1. Settings
  const pharmacySettings = {
    name: "Medivyx",
    tagline: "Your community pharmacy on Lumumba Drive, Roysambu",
    phone: "+254712222524",
    whatsapp: "254712222524",
    email: "orders@medivyx.co.ke",
    address: "Lumumba Drive, Roysambu, Nairobi, Kenya",
    hoursLabel: "Open daily · 8:00 AM – 10:30 PM",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Medivyx+Lumumba+Drive+Roysambu+Nairobi",
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
    premiseLicenceNumber: "",
    premiseLicenceExpiry: "",
    superintendentName: "",
    superintendentReg: "",
    notes: "Licence details will be updated upon receipt of current PPB certificate.",
  }

  await prisma.setting.upsert({
    where: { key: "pharmacy" },
    create: { key: "pharmacy", value: JSON.stringify(pharmacySettings) },
    update: { value: JSON.stringify(pharmacySettings) },
  })
  await prisma.setting.upsert({
    where: { key: "delivery" },
    create: { key: "delivery", value: JSON.stringify(deliverySettings) },
    update: { value: JSON.stringify(deliverySettings) },
  })
  await prisma.setting.upsert({
    where: { key: "compliance" },
    create: { key: "compliance", value: JSON.stringify(complianceSettings) },
    update: { value: JSON.stringify(complianceSettings) },
  })
  console.log("✓ Settings seeded")

  // 2. Staff Accounts
  // Passwords: admin123, pharm123, staff123, rider123
  const staffMembers = [
    {
      id: "medivyx-staff-admin",
      email: "admin@medivyx.co.ke",
      name: "Medivyx Admin",
      role: "ADMIN",
      title: "Owner / Manager",
      passwordHash: "2728e1111fcac50ae8ef045eb6a25c73:322c9dd89d84dead62c465db97bf9c0875e5594d14b8b257b4db6ff507ef7c80d6113d6c3765809c0039127ec36a33c46ff3e4b906a92f553ecbb4a67e4a6578",
    },
    {
      id: "medivyx-staff-pharmacist",
      email: "pharmacist@medivyx.co.ke",
      name: "Hilda Khasaya",
      role: "PHARMACIST",
      title: "Pharmaceutical Technologist",
      passwordHash: "d37542dcf19f7ee266237672e651587b:66226f44b8000bd5e343a8f2b2e5dbe7f835ddf8bb67e4138754ea5376728beef96d5d8911cdecbbe3792e193f7273a4fd2d736d57e8ebbc3109953c5b7a935c",
    },
    {
      id: "medivyx-staff-member",
      email: "staff@medivyx.co.ke",
      name: "Brian Otieno",
      role: "STAFF",
      title: "Counter / Fulfilment",
      passwordHash: "b4082c2991d4c6b6433746744ce420ca:4e89377485cce64413f144b6c609d6e2876024ecd7b6b84590857e9a766b3bdd5fea039bf11c81f58dffe4e7cebb33021f99ed7756df95190730b6e8a3488ced",
    },
    {
      id: "medivyx-staff-rider",
      email: "rider@medivyx.co.ke",
      name: "Kevin Mwangi",
      role: "RIDER",
      title: "Delivery Rider",
      passwordHash: "102157183ed53b3689ae885ab3362d44:e9b2551006cd6f6de422f77e6bc148dea947d45ec4812c3ea250f687afaf64a2dfca70e7af30c1bcf210adf7bac5afc37426139449b54fa1c62ea6182f74818c",
    },
  ]

  for (const staff of staffMembers) {
    await prisma.staffUser.upsert({
      where: { email: staff.email },
      create: {
        id: staff.id,
        email: staff.email,
        name: staff.name,
        role: staff.role,
        title: staff.title,
        passwordHash: staff.passwordHash,
        active: true,
      },
      update: {
        name: staff.name,
        role: staff.role,
        title: staff.title,
        passwordHash: staff.passwordHash,
        active: true,
      },
    })
  }
  console.log("✓ Staff users seeded (Admin, Pharmacist, Staff, Rider)")

  // 3. Customer Accounts
  // Password: customer123
  await prisma.user.upsert({
    where: { email: "customer@medivyx.co.ke" },
    create: {
      id: "medivyx-customer-amina",
      email: "customer@medivyx.co.ke",
      name: "Amina Wanjiru",
      phone: "+254712000001",
      passwordHash: "ef72fcd76c315caa7669e2b5c63e7687:9594c774fb9d837386d5ec2145b1e6414e3232a7977271bb62d72d32ec90ff7e2af40bbf766bc17b064cc7dccc66354729d40eddd47d83f1eb217d09706eaf36",
      loyaltyPoints: 620,
      phoneVerifiedAt: new Date(),
    },
    update: {
      name: "Amina Wanjiru",
      phone: "+254712000001",
      loyaltyPoints: 620,
    },
  })
  console.log("✓ Demo customer seeded (customer@medivyx.co.ke)")

  // 4. Promotions
  const promotions = [
    {
      id: "promo-vitc15",
      title: "Vitamin C month — 15% off",
      description: "Immunity boosters from KSh 467. Offer on selected vitamins & supplements this month.",
      badge: "15% OFF",
      code: "VITC15",
      discountPct: 15,
      color: "amber",
      active: true,
      isPublic: true,
    },
    {
      id: "promo-freedel",
      title: "Free delivery within Roysambu",
      description: "Orders over KSh 3,000 delivered free within Roysambu / TRM area.",
      badge: "FREE DELIVERY",
      code: null,
      discountPct: null,
      color: "teal",
      active: true,
      isPublic: true,
    },
    {
      id: "promo-firstaid",
      title: "Family First Aid Kit — KSh 2,200",
      description: "Complete kit for homes and cars. Was KSh 2,600.",
      badge: "SAVE 400",
      code: null,
      discountPct: null,
      color: "rose",
      active: true,
      isPublic: true,
    },
    {
      id: "promo-save10",
      title: "Welcome offer — 10% off your first order",
      description: "New customers save 10% on any OTC order over KSh 1,000. Use code SAVE10 at checkout.",
      badge: "10% OFF",
      code: "SAVE10",
      discountPct: 10,
      color: "emerald",
      active: true,
      isPublic: true,
    },
  ]

  for (const promo of promotions) {
    await prisma.promotion.upsert({
      where: { id: promo.id },
      create: promo,
      update: promo,
    })
  }
  console.log("✓ Promotions seeded")

  // 5. Clinical Services & Availability
  const services = [
    {
      id: "service-consultation",
      name: "Pharmacist Consultation",
      slug: "pharmacist-consultation",
      price: 0,
      durationMinutes: 20,
      category: "Consultation",
      shortDescription: "A confidential one-on-one session with our certified pharmacist on medication review, side effects, and health questions.",
      description: "Speak directly with our certified clinical pharmacist in our private consultation room. Ideal for reviewing multiple concurrent medications, understanding potential drug interactions, asking about side effects, or seeking guidance before doctor visits.",
      heroImage: "/images/pharmacist-consult.png",
      featured: true,
      active: true,
      sortOrder: 1,
    },
    {
      id: "service-bp-wellness",
      name: "Blood Pressure & Wellness Check",
      slug: "blood-pressure-wellness-check",
      price: 200,
      durationMinutes: 15,
      category: "Wellness & Vitals",
      shortDescription: "Accurate blood pressure reading, BMI calculation, and lifestyle consultation by our clinical team.",
      description: "Walk in or schedule your routine cardiovascular check. Includes high-accuracy digital and manual sphygmomanometer checks, heart rate rhythm observation, BMI and body composition metrics, and a printed health record card.",
      heroImage: "/images/categories/cat-heart-health.webp",
      featured: true,
      active: true,
      sortOrder: 2,
    },
    {
      id: "service-diagnostics",
      name: "Testing & Diagnostic Screening",
      slug: "diagnostic-testing-screening",
      price: 500,
      durationMinutes: 20,
      category: "Diagnostics",
      shortDescription: "Rapid blood glucose, cholesterol screening, malaria, or typhoid rapid testing with on-the-spot clinical counsel.",
      description: "Certified point-of-care rapid testing conducted with single-use sterile lancets and calibrated analyzers. Results delivered within 15 minutes with post-test counselling and physician referral letters if needed.",
      heroImage: "/images/categories/cat-diagnostics.webp",
      featured: true,
      active: true,
      sortOrder: 3,
    },
    {
      id: "service-prescriptions",
      name: "Prescription Support & Refill Management",
      slug: "prescription-support-refills",
      price: 0,
      durationMinutes: 25,
      category: "Prescription",
      shortDescription: "Comprehensive review of chronic prescription regimens, drug interaction checks, and refill scheduling.",
      description: "Bring your existing paper or hospital digital prescription. Our pharmacists will review dose appropriateness, organize automated monthly refills, liaise with your doctor when adjustments are indicated, and ensure complete dispensing history tracking.",
      heroImage: "/images/categories/cat-prescription.webp",
      featured: true,
      active: true,
      sortOrder: 4,
    },
  ]

  for (const s of services) {
    const service = await prisma.service.upsert({
      where: { slug: s.slug },
      create: s,
      update: s,
    })

    // Add availability for days Monday (1) through Saturday (6) from 09:00 to 18:00
    for (let day = 1; day <= 6; day++) {
      await prisma.serviceAvailability.upsert({
        where: {
          serviceId_dayOfWeek_startTime_endTime: {
            serviceId: service.id,
            dayOfWeek: day,
            startTime: "09:00",
            endTime: "18:00",
          },
        },
        create: {
          serviceId: service.id,
          dayOfWeek: day,
          startTime: "09:00",
          endTime: "18:00",
          enabled: true,
        },
        update: { enabled: true },
      })
    }
  }
  console.log("✓ Clinical services and weekly availability slots seeded")
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
