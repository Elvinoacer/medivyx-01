"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import { ArrowRight, HeartPulse, MessageCircle, ShieldCheck, Sparkles } from "lucide-react"
import { useAppStore } from "@/store/use-app-store"
import { servicesApi } from "@/lib/api-client"
import type { ServiceDTO } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { waLink } from "@/lib/constants"

const FALLBACK = [
  { title: "Testing & screening", text: "Rapid tests and everyday screening support from the pharmacy team.", image: "/images/categories/cat-diagnostics.webp" },
  { title: "Blood pressure & wellness", text: "Convenient checks for everyday health monitoring and wellness.", image: "/images/categories/cat-heart-health.webp" },
  { title: "Pharmacist consultation", text: "A private conversation about medicines, prescriptions and health questions.", image: "/images/pharmacist-consult.png" },
  { title: "Prescription support", text: "Bring your prescription or upload it online for pharmacist review.", image: "/images/categories/cat-prescription.webp" },
]

export function ServicesShowcase() {
  const navigate = useAppStore((s) => s.navigate)
  const [services, setServices] = useState<ServiceDTO[]>([])
  useEffect(() => {
    let cancelled = false
    servicesApi.list().then((data) => { if (!cancelled) setServices(data.filter((s) => s.featured).slice(0, 4)) }).catch(() => {})
    return () => { cancelled = true }
  }, [])
  const cards = services.length ? services : FALLBACK
  const leadImage = "id" in cards[0] ? (cards[0].heroImage || "/images/pharmacist-consult.png") : cards[0].image
  return (
    <section className="reference-services" aria-labelledby="services-heading">
      <div className="reference-container reference-services-inner">
        <div className="reference-services-visual">
          <div className="reference-services-image">
            <Image src={leadImage} alt="Sphere Pharmacy care service" fill sizes="(max-width: 740px) 80vw, (max-width: 980px) 36vw, 420px" />
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
            {cards.map((service) => (
              <Card key={"id" in service ? service.id : service.title} className="reference-service-card">
                <div className="reference-service-thumb">
                  <Image src={"id" in service ? (service.heroImage || "/images/pharmacist-consult.png") : service.image} alt="" aria-hidden fill sizes="(max-width: 520px) 96px, (max-width: 740px) 50vw, 92px" />
                  <span><HeartPulse className="h-4 w-4" /></span>
                </div>
                <div className="reference-service-content"><h3>{"name" in service ? service.name : service.title}</h3><p>{"shortDescription" in service ? (service.shortDescription || service.description || "") : service.text}</p><span>Explore services <ArrowRight className="h-3.5 w-3.5" /></span></div>
              </Card>
            ))}
          </div>
          <div className="reference-services-actions">
            <Button className="reference-services-primary" onClick={() => navigate("services")}><Sparkles className="h-4 w-4" /> Explore all services</Button>
            <a href={waLink("Hello Sphere Pharmacy! I would like to ask about your available health services.")} target="_blank" rel="noreferrer" className="reference-services-secondary"><MessageCircle className="h-4 w-4" /> Ask on WhatsApp</a>
          </div>
        </div>
      </div>
    </section>
  )
}
