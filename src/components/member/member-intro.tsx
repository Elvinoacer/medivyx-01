"use client";

import {
  ArrowUpRight,
  CalendarDays,
  FileText,
  Package,
  Sparkles,
} from "lucide-react";
import { useAuthStore } from "@/store/use-auth-store";
import { useAppStore } from "@/store/use-app-store";

const copy = {
  account: {
    eyebrow: "YOUR OWN LITTLE CORNER",
    title: "Welcome back,",
    emphasis: "",
    description:
      "Your care, your plans, your everyday. Everything you need, together in one place.",
  },
  orders: {
    eyebrow: "FROM OUR HANDS TO YOURS",
    title: "Your essentials.",
    emphasis: "Every step, in sight.",
    description:
      "Track your orders, review payments, and find the things you reach for again.",
  },
  prescriptions: {
    eyebrow: "PERSONAL CARE. THOUGHTFUL ATTENTION.",
    title: "Your prescriptions.",
    emphasis: "In caring hands.",
    description:
      "Upload a prescription, follow its review, and request refills with your pharmacy team.",
  },
  appointments: {
    eyebrow: "A LITTLE TIME FOR YOURSELF",
    title: "Your appointments.",
    emphasis: "Care worth making time for.",
    description:
      "Keep your upcoming visits, booking updates, and payment options close at hand.",
  },
};
export function MemberIntro({ kind }: { kind: keyof typeof copy }) {
  const session = useAuthStore((s) => s.session);
  const navigate = useAppStore((s) => s.navigate);
  const firstName = session?.user?.name?.trim().split(/\s+/)[0] || "friend";
  const content = copy[kind];
  return (
    <>
      <section className={`sphere-member-intro sphere-member-${kind}`}>
        <div className="sphere-member-copy">
          <p>{content.eyebrow}</p>
          <h1>
            {content.title}
            <br />
            <em>{kind === "account" ? `${firstName}.` : content.emphasis}</em>
          </h1>
          <p className="sphere-member-description">{content.description}</p>
          <button onClick={() => useAppStore.getState().setAssistantOpen(true)}>
            <Sparkles size={16} /> A little help from Sphere{" "}
            <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="sphere-member-art" aria-hidden="true">
          <div />
          <span>
            {kind === "account" ? (
              firstName.slice(0, 1).toUpperCase()
            ) : kind === "orders" ? (
              <Package />
            ) : kind === "prescriptions" ? (
              <FileText />
            ) : (
              <CalendarDays />
            )}
          </span>
          <small>CARE, ALL AROUND.</small>
        </div>
      </section>
      {kind === "account" && (
        <nav
          className="sphere-member-shortcuts"
          aria-label="Your care shortcuts"
        >
          {[
            {
              name: "My orders",
              note: "Track, pay & reorder",
              icon: Package,
              view: "orders" as const,
            },
            {
              name: "Prescriptions",
              note: "Upload & follow reviews",
              icon: FileText,
              view: "prescriptions" as const,
            },
            {
              name: "Appointments",
              note: "Make time for your care",
              icon: CalendarDays,
              view: "services" as const,
            },
          ].map((item) => (
            <button
              key={item.name}
              onClick={() =>
                navigate(
                  item.view,
                  item.view === "services" ? { tab: "bookings" } : undefined,
                )
              }
            >
              <item.icon size={23} strokeWidth={1.5} />
              <span>
                <strong>{item.name}</strong>
                <small>{item.note}</small>
              </span>
              <ArrowUpRight size={18} />
            </button>
          ))}
        </nav>
      )}
    </>
  );
}
