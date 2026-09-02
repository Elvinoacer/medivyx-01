// Curated product photo library shipped with the app (public/images/products).
// The admin product editor picks from these real photos — no more emoji tiles.
// Keep in sync with the files under public/images/products.

export interface LibraryImage {
  path: string
  label: string
}

const entry = (name: string, label: string): LibraryImage => ({
  path: `/images/products/${name}.webp`,
  label,
})

export const PRODUCT_IMAGE_LIBRARY: LibraryImage[] = [
  entry("generic-medicine", "Generic medicine"),
  entry("generic-paracetamol", "Paracetamol tin"),
  entry("panadol-tablets", "Paracetamol tablets box"),
  entry("ibuprofen-tablets", "Ibuprofen tablets"),
  entry("aspirin-tablets", "Aspirin low-dose"),
  entry("metformin-tablets", "Diabetes tablets bottle"),
  entry("bp-tablets", "BP tablets"),
  entry("rx-tablets-generic", "Rx tablets (plain)"),
  entry("antibiotic-capsules", "Antibiotic capsules"),
  entry("omeprazole-capsules", "Gastro capsules"),
  entry("diarrhoea-capsules", "Anti-diarrhoea capsules"),
  entry("allergy-tablets-white", "Allergy tablets"),
  entry("allergy-tablets-blister", "Allergy blister"),
  entry("stomach-cramp-tablets", "Stomach cramp tablets"),
  entry("cold-flu-tablets", "Cold & flu tablets"),
  entry("cold-sachets", "Cold sachets"),
  entry("throat-lozenges", "Throat lozenges"),
  entry("asthma-inhaler", "Asthma inhaler"),
  entry("antacid-powder", "Antacid powder"),
  entry("ors-sachets", "ORS sachets"),
  entry("vitamin-c-effervescent", "Vitamin C effervescent"),
  entry("multivitamin-tablets", "Multivitamin tablets"),
  entry("multivitamin-bottle", "Multivitamin bottle"),
  entry("iron-tablets", "Iron tablets"),
  entry("calcium-tablets", "Calcium + D3"),
  entry("omega3-softgels", "Omega-3 softgels"),
  entry("oral-syrup", "Oral syrup"),
  entry("cough-syrup", "Cough syrup"),
  entry("mixture-bottle", "Mixture bottle"),
  entry("baby-digestive-syrup", "Baby syrup"),
  entry("diclofenac-gel", "Anti-inflammatory gel"),
  entry("pain-spray", "Pain relief spray"),
  entry("antifungal-cream", "Antifungal cream"),
  entry("hydrocortisone-cream", "Hydrocortisone cream"),
  entry("moisturising-cream", "Moisturising cream jar"),
  entry("facial-cleanser", "Facial cleanser"),
  entry("toothpaste", "Toothpaste"),
  entry("soap-bars", "Soap bars"),
  entry("antiseptic-liquid", "Antiseptic liquid"),
  entry("hand-sanitiser", "Hand sanitiser"),
  entry("baby-oil", "Baby oil"),
  entry("baby-nappies", "Baby nappies"),
  entry("baby-cereal", "Baby cereal"),
  entry("infant-formula", "Infant formula"),
  entry("condoms", "Condoms"),
  entry("contraceptive-pills", "Contraceptive pills"),
  entry("pregnancy-test", "Pregnancy test"),
  entry("malaria-test-kit", "Malaria test kit"),
  entry("glucose-strips", "Glucose strips"),
  entry("lancets", "Lancets"),
  entry("glucometer-kit", "Glucometer kit"),
  entry("bp-monitor", "BP monitor"),
  entry("thermometer", "Thermometer"),
  entry("pulse-oximeter", "Pulse oximeter"),
  entry("plasters", "Plasters"),
  entry("crepe-bandage", "Crepe bandage"),
  entry("first-aid-kit", "First aid kit"),
  entry("face-masks", "Face masks"),
]
