"use client"

import { ArrowRight, FlaskConical, HeartPulse, MessageCircle, ShieldCheck, Sparkles } from "lucide-react"
import { useAppStore } from "@/store/use-app-store"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { waLink } from "@/lib/constants"

const SERVICES = [
  { title: "Testing & screening", text: "Rapid tests and everyday screening support from the pharmacy team.", image: "/images/categories/cat-diagnostics.webp", icon: FlaskConical },
  { title: "Blood pressure & wellness", text: "Convenient checks for everyday health monitoring and wellness.", image: "/images/categories/cat-heart-health.webp", icon: HeartPulse },
  { title: "Pharmacist consultation", text: "A private conversation about medicines, prescriptions and health questions.", image: "/images/pharmacist-consult.png", icon: ShieldCheck },
  { title: "Prescription support", text: "Bring your prescription or upload it online for pharmacist review.", image: "/images/categories/cat-prescription.webp", icon: ShieldCheck },
]

export function ServicesShowcase() {
  const navigate = useAppStore((s) => s.navigate)
  return (
    <section className="reference-services" aria-labelledby="services-heading">
      <div className="reference-container reference-services-inner">
        <div className="reference-services-visual">
          <div className="reference-services-image">
            <img src="/images/pharmacist-consult.png" alt="Sphere Pharmacy pharmacist consulting with a customer" width={1152} height={864} loading="lazy" />
            <div className="reference-services-image-overlay" />
            <div className="reference-services-caption">
              <span className="reference-services-caption-icon"><ShieldCheck className="h-4 w-4" /></span>
              <span><strong>Care beyond the counter</strong><small>People-first pharmacy support</small></span>
            </div>
          </div>
        </div>
        <div className="reference-services-copy">
          <p className="reference-services-eyebrow">Pharmacy care</p>
          <h2 id="services-heading">More than a place to buy medicine.</h2>
          <p className="reference-services-intro">Explore the health services our pharmacy offers alongside your everyday medicines and wellness products.</p>
          <div className="reference-services-grid">
            {SERVICES.map((service) => { const Icon = service.icon; return <Card key={service.title} className="reference-service-card"><div className="reference-service-thumb"><img src={service.image} alt="" aria-hidden loading="lazy" /><span><Icon className="h-4 w-4" /></span></div><div className="reference-service-content"><h3>{service.title}</h3><p>{service.text}</p><span>Explore services <ArrowRight className="h-3.5 w-3.5" /></span></div></Card> })}
          </div>
          <div className="reference-services-actions">
            <Button className="reference-services-primary" onClick={() => navigate("services")}><Sparkles className="h-4 w-4" /> Explore all services</Button>
            <a href={waLink("Hello Sphere Pharmacy! I'd like to ask about your available health services.")} target="_blank" rel="noreferrer" className="reference-services-secondary"><MessageCircle className="h-4 w-4" /> Ask on WhatsApp</a>
          </div>
        </div>
      </div>
    </section>
  )
}
