"use client";

import {
  ArrowUpRight,
  ShoppingBag,
  Upload,
  UserRound,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { useAppStore, type ViewName } from "@/store/use-app-store";
import { useCartStore } from "@/store/use-cart-store";
import { LogoFull } from "@/components/shared/logo";
import { NotificationCenter } from "@/components/layout/notification-center";
import { waLink } from "@/lib/constants";

export function SphereHeader() {
  const navigate = useAppStore((s) => s.navigate);
  const view = useAppStore((s) => s.view);
  const count = useCartStore((s) => s.lines.reduce((n, l) => n + l.qty, 0));
  const [expanded, setExpanded] = useState(false);
  function go(next: ViewName) {
    setExpanded(false);
    navigate(next);
  }
  return (
    <header className="sphere-site-header">
      <div className="sphere-header-row">
        <button
          className="sphere-original-logo"
          onClick={() => go("home")}
          aria-label="Sphere Pharmacy home"
        >
          <LogoFull />
        </button>
        <nav className="sphere-desktop-links" aria-label="Main navigation">
          {(
            [
              { name: "Shop health", view: "catalog" },
              { name: "Offers", view: "offers" },
              { name: "Care services", view: "services" },
              { name: "Prescriptions", view: "prescriptions" },
            ] as const
          ).map((item) => (
            <button
              key={item.view}
              aria-current={view === item.view ? "page" : undefined}
              onClick={() => go(item.view)}
            >
              {item.name}
            </button>
          ))}
        </nav>
        <div className="sphere-header-actions">
          <NotificationCenter />
          <a className="sphere-talk" href={waLink()}>
            Let’s talk <ArrowUpRight size={17} />
          </a>
          <button
            className="sphere-account"
            onClick={() => go("account")}
            aria-label="My account"
          >
            <UserRound size={21} />
          </button>
          <button
            className="sphere-bag"
            onClick={() => go("cart")}
            aria-label={`Shopping bag, ${count} items`}
          >
            <ShoppingBag size={21} />
            <span>{count}</span>
          </button>
          <button
            className="sphere-menu-toggle"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-controls="sphere-menu"
            aria-label={expanded ? "Close navigation" : "Open navigation"}
          >
            {expanded ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {expanded && (
        <nav
          id="sphere-menu"
          className="sphere-expanded-menu"
          aria-label="More destinations"
        >
          <button onClick={() => go("prescriptions")}>
            <Upload size={18} /> Upload prescription <ArrowUpRight size={16} />
          </button>
          <button onClick={() => go("offers")}>
            Current offers <ArrowUpRight size={16} />
          </button>
          <button onClick={() => go("services")}>
            Explore care services <ArrowUpRight size={16} />
          </button>
          <button onClick={() => go("orders")}>
            Track my orders <ArrowUpRight size={16} />
          </button>
          <button onClick={() => go("account")}>
            My account <ArrowUpRight size={16} />
          </button>
        </nav>
      )}
    </header>
  );
}
