"use client"

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Copy, Gift, Loader2, ShoppingBag, TicketPercent, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { promotionsApi } from "@/lib/api-client";
import type { PromotionDTO } from "@/lib/types";
import { useAppStore } from "@/store/use-app-store";
import { useCartStore } from "@/store/use-cart-store";
import { rememberOffer } from "@/lib/offer-intent";
import { formatKES } from "@/lib/format";

function expiryLabel(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-KE", {
    timeZone: "Africa/Nairobi", day: "numeric", month: "short", year: "numeric",
  }).format(date);
}

export function OffersView() {
  const navigate = useAppStore((s) => s.navigate);
  const lines = useCartStore((s) => s.lines);
  const subtotal = lines.reduce((sum, line) => sum + line.qty * line.price, 0);
  const [offers, setOffers] = useState<PromotionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    promotionsApi.list()
      .then((data) => {
        if (!active) return;
        setOffers(data.filter((p) => p.active && p.code && p.discountPct));
        setError(null);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Offers are temporarily unavailable.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]);

  function tryAgain() {
    setLoading(true);
    setError(null);
    setRefresh((n) => n + 1);
  }

  function selectOffer(code: string, canApply: boolean) {
    rememberOffer(code);
    if (lines.length && canApply) {
      navigate("checkout", { promo: code });
    } else {
      navigate("catalog");
      toast.message("Offer saved for checkout", {
        description: "Add eligible products to your bag; the code will be checked at checkout.",
      });
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      toast.success("Code copied", { description: "Enter it at checkout to check your eligibility." });
    } catch {
      toast.error("Could not copy automatically", { description: "Select the displayed code and copy it manually." });
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-7 sm:px-6 sm:pt-12">
      <button type="button" className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-primary" onClick={() => navigate("home")}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to home
      </button>
      <header className="mb-9 max-w-3xl">
        <span className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-primary">
          <TicketPercent className="h-4 w-4" aria-hidden="true" /> Medivyx offers
        </span>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">A little more care, for less.</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
          Browse currently available checkout codes without crowding your shopping experience.
          Offers may have minimum spends or redemption limits. Your final saving is confirmed at checkout.
        </p>
      </header>

      {loading ? (
        <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Checking current offers…
        </div>
      ) : error ? (
        <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
            <div><h2 className="font-semibold">We couldn't load offers</h2><p className="mt-1 text-sm text-muted-foreground">{error}</p></div>
          </div>
          <button type="button" onClick={tryAgain} className="mt-5 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold hover:bg-muted">
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
          </button>
        </div>
      ) : offers.length === 0 ? (
        <div className="rounded-3xl border bg-card px-6 py-12 text-center">
          <Gift className="mx-auto mb-4 h-9 w-9 text-primary" aria-hidden="true" />
          <h2 className="text-xl font-semibold">No checkout offers right now</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">There's still plenty to discover in the pharmacy. Check this page again for future offers.</p>
          <button type="button" onClick={() => navigate("catalog")} className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground">
            Browse products <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2" aria-label="Current checkout offers">
          {offers.map((offer) => {
            const code = offer.code!;
            const shortfall = Math.max(0, (offer.minimumSpend ?? 0) - subtotal);
            const eligibleSubtotal = subtotal > 0 && shortfall === 0;
            const end = expiryLabel(offer.endsAt);
            return (
              <article key={offer.id} className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
                <div className="border-b border-border bg-emerald-50/70 px-6 py-5 dark:bg-emerald-950/20">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">{offer.discountPct}% off</span>
                    {offer.badge ? <span className="text-xs font-semibold text-primary">{offer.badge}</span> : null}
                  </div>
                  <h2 className="mt-4 text-xl font-semibold leading-7 text-foreground">{offer.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{offer.description}</p>
                </div>
                <div className="flex flex-1 flex-col gap-4 px-6 py-5">
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                    <span>{offer.minimumSpend ? `Minimum ${formatKES(offer.minimumSpend)}` : "No minimum spend"}</span>
                    {end ? <span>Ends {end}</span> : null}
                    {offer.perUserLimit != null ? <span>Sign-in required to redeem</span> : null}
                  </div>
                  {lines.length && shortfall > 0 ? (
                    <p className="rounded-lg bg-muted px-3 py-2 text-xs text-foreground">
                      Add {formatKES(shortfall)} more to your bag to meet this offer's minimum spend.
                    </p>
                  ) : null}
                  <div className="mt-auto flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-primary/40 bg-muted/40 p-2">
                    <span className="min-w-0 flex-1 select-all truncate px-2 font-mono text-sm font-bold tracking-wide" aria-label={`Offer code ${code}`}>{code}</span>
                    <button type="button" onClick={() => void copyCode(code)}
                      aria-label={`Copy code ${code}`}
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg border bg-background px-3 text-xs font-semibold transition hover:border-primary/50">
                      {copied === code ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied === code ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <button type="button" onClick={() => selectOffer(code, eligibleSubtotal)}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90">
                    {eligibleSubtotal ? <ShoppingBag className="h-4 w-4" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                    {eligibleSubtotal ? "Check this code at checkout" : "Shop with this offer"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <p className="mt-8 text-center text-xs leading-5 text-muted-foreground">
        A displayed offer is not a guaranteed discount. The pharmacy confirms availability,
        account and redemption limits, minimum spend and discount at checkout.
      </p>
    </div>
  );
}
