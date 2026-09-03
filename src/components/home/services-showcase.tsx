import { ArrowRight, FlaskConical, HeartPulse, MessageCircle, ShieldCheck } from "lucide-react"
import { Card } from "@/components/ui/card"
import { waLink } from "@/lib/constants"

const SERVICES = [
  { title: "Testing & screening", text: "Ask our team about available rapid tests and basic health screening services.", image: "/images/categories/cat-diagnostics.webp", icon: FlaskConical },
  { title: "Blood pressure & wellness", text: "Convenient checks to help you keep track of everyday health markers.", image: "/images/categories/cat-heart-health.webp", icon: HeartPulse },
  { title: "Pharmacist consultation", text: "Talk through your medicines, prescriptions and everyday health questions.", image: "/images/pharmacist-consult.png", icon: ShieldCheck },
  { title: "Prescription support", text: "Bring your prescription in-store or upload it online for pharmacist review.", image: "/images/categories/cat-prescription.webp", icon: ShieldCheck },
]

export function ServicesShowcase() {
  return (
    <section className="reference-services" aria-labelledby="services-heading">
      <div className="reference-container reference-services-inner">
        <div className="reference-services-visual">
          <div className="reference-services-image">
            <img src="/images/pharmacist-consult.png" alt="Sphere Pharmacy pharmacist consulting with a customer" width={1152} height={864} loading="lazy" />
            <div className="reference-services-image-overlay" />
            <div className="reference-services-caption">
              <span className="reference-services-caption-icon"><ShieldCheck className="h-4 w-4" /></span>
              <span><strong>Care beyond the counter</strong><small>Practical support from our pharmacy team</small></span>
            </div>
          </div>
        </div>
        <div className="reference-services-copy">
          <p className="reference-services-eyebrow">Pharmacy care services</p>
          <h2 id="services-heading">More than a place to buy medicine.</h2>
          <p className="reference-services-intro">From testing and health checks to pharmacist support, we offer care that goes beyond the products on our shelves.</p>
          <div className="reference-services-grid">
            {SERVICES.map((service) => {
              const Icon = service.icon
              return (
                <Card key={service.title} className="reference-service-card">
                  <div className="reference-service-thumb">
                    <img src={service.image} alt="" aria-hidden loading="lazy" />
                    <span><Icon className="h-4 w-4" /></span>
                  </div>
                  <div className="reference-service-content">
                    <h3>{service.title}</h3>
                    <p>{service.text}</p>
                    <span>Ask our team <ArrowRight className="h-3.5 w-3.5" /></span>
                  </div>
                </Card>
              )
            })}
          </div>
          <div className="reference-services-actions">
            <a href={waLink("Hello Sphere Pharmacy! I'd like to ask about your health services and testing availability.")} target="_blank" rel="noreferrer" className="reference-services-primary"><MessageCircle className="h-4 w-4" /> Ask about a service</a>
            <span className="reference-services-note">Availability may vary — WhatsApp us to confirm.</span>
          </div>
        </div>
      </div>
    </section>
  )
}
