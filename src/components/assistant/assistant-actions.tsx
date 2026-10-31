"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  CreditCard,
  Loader2,
  ShoppingBag,
  X,
} from "lucide-react";
import {
  orderCanBePaid,
  bookingCanBePaid,
  reviewAmount,
} from "@/lib/assistant/payment-review";
import type { AssistantAction } from "@/lib/assistant/contracts";
import {
  ApiError,
  catalogApi,
  ordersApi,
  paymentsApi,
  serviceBookingsApi,
  servicePaymentsApi,
  servicesApi,
} from "@/lib/api-client";
import type {
  ServiceBookingDTO,
  ServiceDTO,
  ServiceSlotDTO,
} from "@/lib/types";
import { useAppStore } from "@/store/use-app-store";
import { useAuthStore } from "@/store/use-auth-store";
import { useCartStore } from "@/store/use-cart-store";
import { formatKES } from "@/lib/format";

export function AssistantActionCard({
  action,
  onPrivateAction,
  onNavigate,
}: {
  action: AssistantAction;
  onPrivateAction: (action: AssistantAction) => void;
  onNavigate: () => void;
}) {
  const navigate = useAppStore((s) => s.navigate);
  const openAuth = useAppStore((s) => s.openAuth);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  function run() {
    if (action.type === "book" || action.type === "pay") {
      onPrivateAction(action);
      return;
    }
    if (action.type === "product")
      navigate("product", { productId: action.id });
    else if (action.type === "search") {
      useAppStore.getState().resetCatalogFilters();
      useAppStore.getState().setCatalogFilters({ search: action.query });
      navigate("catalog");
    } else if (action.type === "appointments")
      navigate("services", { tab: "bookings" });
    else if (action.type === "navigate") {
      if (
        action.view === "checkout" &&
        !useAuthStore.getState().session?.user
      ) {
        openAuth(
          "login",
          "checkout",
          "Sign in to review your checkout. Your bag is saved.",
        );
        onNavigate();
        return;
      }
      navigate(action.view);
    }
    onNavigate();
  }
  async function add() {
    if (action.type !== "product" || lock.current) return;
    lock.current = true;
    setBusy(true);
    setStatus("");
    try {
      const product = await catalogApi.product(action.id);
      const cart = useCartStore.getState();
      const qty = cart.lines.find((l) => l.productId === product.id)?.qty || 0;
      if (
        !["IN_STOCK", "LOW_STOCK"].includes(product.stockStatus) ||
        product.stockQty <= qty
      )
        throw new Error(
          "There isn’t enough stock for another pack. Please check with our team.",
        );
      if (product.price !== action.price)
        throw new Error(
          "The price has changed. Open the product to review its current price before adding it.",
        );
      cart.add(
        {
          productId: product.id,
          name: product.name,
          price: product.price,
          image: product.image,
          requiresPrescription: product.requiresPrescription,
          packSize: product.packSize,
          stockStatus: product.stockStatus,
        },
        1,
      );
      setStatus(
        "One pack added to your bag. You can review it before checkout.",
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "That didn’t work. Please try opening the product.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="sphere-ai-action">
      <div className="sphere-ai-action-title">
        {action.type === "book" ? (
          <CalendarDays size={18} />
        ) : action.type === "pay" ? (
          <CreditCard size={18} />
        ) : (
          <ShoppingBag size={18} />
        )}
        <strong>{action.label}</strong>
      </div>
      {action.type === "product" && (
        <p>
          {formatKES(action.price)}
          {action.packSize ? ` · ${action.packSize}` : ""}
          <br />
          {action.requiresPrescription
            ? "Prescription & pharmacist review required"
            : "Product listing — not a treatment recommendation"}
        </p>
      )}
      {action.type === "book" && (
        <p>
          {action.duration} minutes ·{" "}
          {action.price === null
            ? "Ask the pharmacy for pricing"
            : formatKES(action.price)}
        </p>
      )}
      <div className="sphere-ai-action-buttons">
        <button onClick={run}>
          {action.type === "product"
            ? "View exact product"
            : action.type === "book"
              ? "Choose a time"
              : action.type === "pay"
                ? "Review payment options"
                : "Open"}
          <ArrowUpRight size={16} />
        </button>
        {action.type === "product" && (
          <button
            onClick={add}
            disabled={
              busy ||
              !!status.startsWith("One pack") ||
              !["IN_STOCK", "LOW_STOCK"].includes(action.stockStatus)
            }
          >
            {busy ? (
              <Loader2 className="animate-spin" size={15} />
            ) : (
              <ShoppingBag size={15} />
            )}{" "}
            {status.startsWith("One pack") ? "Added" : "Add one pack"}
          </button>
        )}
      </div>
      {status && (
        <p role="status" className="sphere-ai-feedback">
          {status}
        </p>
      )}
    </div>
  );
}

type Payable = {
  kind: "order" | "booking";
  id: string;
  reference: string;
  amount: number;
  description: string;
};
export function AssistantPrivatePanel({
  action,
  onClose,
  onNavigate,
}: {
  action: AssistantAction;
  onClose: () => void;
  onNavigate: () => void;
}) {
  const session = useAuthStore((s) => s.session);
  if (!session?.user)
    return (
      <div className="sphere-ai-private">
        <button
          className="sphere-ai-panel-close"
          onClick={onClose}
          aria-label="Close action"
        >
          <X size={18} />
        </button>
        <h3>Your account, kept private.</h3>
        <p>
          Sign in to book or pay. Your account details won’t be sent to the AI.
        </p>
        <button
          className="sphere-ai-confirm"
          onClick={() => {
            useAppStore
              .getState()
              .openAuth(
                "login",
                action.type === "book" ? "services" : "orders",
                "Sign in to continue securely.",
                action.type === "book" ? { serviceId: action.id } : undefined,
              );
            onNavigate();
          }}
        >
          Sign in to continue <ArrowUpRight size={16} />
        </button>
      </div>
    );
  return (
    <div className="sphere-ai-private">
      <button
        className="sphere-ai-panel-close"
        onClick={onClose}
        aria-label="Close action"
      >
        <X size={18} />
      </button>
      <span className="sphere-ai-private-label">PRIVATE · YOUR ACCOUNT</span>
      {action.type === "book" ? (
        <BookingForm
          key={action.id}
          serviceId={action.id}
          onNavigate={onNavigate}
        />
      ) : (
        <PaymentForm onNavigate={onNavigate} />
      )}
    </div>
  );
}

function BookingForm({
  serviceId,
  onNavigate,
}: {
  serviceId: string;
  onNavigate: () => void;
}) {
  const [service, setService] = useState<ServiceDTO | null>(null);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<ServiceSlotDTO[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ServiceBookingDTO | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    let live = true;
    servicesApi
      .get(serviceId)
      .then((s) => {
        if (live) setService(s);
      })
      .catch(() => {
        if (live)
          setError(
            "We couldn’t load this service. Please open care services and try again.",
          );
      });
    return () => {
      live = false;
    };
  }, [serviceId]);
  useEffect(() => {
    if (!date) return;
    let live = true;
    setLoading(true);
    setSlots([]);
    setSelected("");
    setError("");
    serviceBookingsApi
      .slots(serviceId, date)
      .then((s) => {
        if (live) setSlots(s);
      })
      .catch(() => {
        if (live)
          setError(
            "Available times couldn’t be loaded. Please choose the date again.",
          );
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [serviceId, date]);
  const slot = slots.find((s) => s.start === selected);
  async function confirm() {
    if (!slot || !service || lock.current || result || uncertain) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const currentService = await servicesApi.get(serviceId);
      if (
        Number(currentService.price) !== Number(service.price) ||
        currentService.durationMinutes !== service.durationMinutes
      )
        throw new Error(
          "The service details changed. Close this card and reopen it to review the latest details.",
        );
      setResult(
        await serviceBookingsApi.create({
          serviceId,
          start: slot.start,
          end: slot.end,
          expectedPrice: service.price == null ? null : Number(service.price),
        }),
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "We couldn’t confirm the result. Check your appointments before trying again.",
      );
      if (!(e instanceof ApiError) || e.status >= 500) setUncertain(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function appointments() {
    useAppStore.getState().navigate("services", { tab: "bookings" });
    onNavigate();
  }
  if (result)
    return (
      <>
        <h3>
          <Check size={21} /> Request received.
        </h3>
        <p>
          {result.serviceName}
          <br />
          {new Date(result.scheduledStart).toLocaleString("en-KE", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Africa/Nairobi",
          })}
          <br />
          Reference: {result.reference}
        </p>
        <p>
          The pharmacy still needs to confirm your appointment. No payment has
          been taken.
        </p>
        <button className="sphere-ai-confirm" onClick={appointments}>
          View appointment & payment options <ArrowUpRight size={16} />
        </button>
      </>
    );
  return (
    <>
      <h3>{service?.name || "Choose an appointment"}</h3>
      {service && (
        <p>
          {service.durationMinutes} minutes ·{" "}
          {service.price === null
            ? "Contact pharmacy for pricing"
            : formatKES(Number(service.price))}
        </p>
      )}
      <label>
        Date (Nairobi)
        <input
          type="date"
          value={date}
          min={new Date().toLocaleDateString("en-CA", {
            timeZone: "Africa/Nairobi",
          })}
          onChange={(e) => setDate(e.target.value)}
          disabled={busy || uncertain}
        />
      </label>
      {loading ? (
        <p role="status">Checking live availability…</p>
      ) : (
        date && (
          <label>
            Available time
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              disabled={busy || uncertain}
            >
              <option value="">
                {slots.length
                  ? "Choose a time"
                  : "No times available — try another day"}
              </option>
              {slots.map((s) => (
                <option key={s.start} value={s.start}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )
      )}
      {slot && (
        <p className="sphere-ai-review">
          Review: {service?.name} on {date} at {slot.label}, Nairobi time. This
          submits a booking request; payment is separate.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <button
        className="sphere-ai-confirm"
        disabled={!slot || !service || busy || uncertain}
        onClick={confirm}
      >
        {busy ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <CalendarDays size={16} />
        )}{" "}
        Confirm booking request
      </button>
      {uncertain && (
        <button onClick={appointments}>Check my appointments first</button>
      )}
    </>
  );
}

function PaymentForm({ onNavigate }: { onNavigate: () => void }) {
  const [items, setItems] = useState<Payable[] | null>(null);
  const [selected, setSelected] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{
    checkoutRequestId: string;
    item: Payable;
  } | null>(null);
  const [paymentStatus, setPaymentStatus] = useState("");
  const attempt = useRef<{
    selection: string;
    phone: string;
    key: string;
  } | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    let live = true;
    Promise.all([ordersApi.myOrders(), serviceBookingsApi.mine()])
      .then(([orders, bookings]) => {
        const ordersToPay = orders.filter(orderCanBePaid).map((o) => ({
          kind: "order" as const,
          id: o.id,
          reference: o.reference,
          amount: Number(o.total),
          description: "Order",
        }));
        const bookingsToPay = bookings.filter(bookingCanBePaid).map((b) => ({
          kind: "booking" as const,
          id: b.id,
          reference: b.reference,
          amount: Number(b.price),
          description: b.serviceName,
        }));
        if (live) setItems([...ordersToPay, ...bookingsToPay]);
      })
      .catch(() => {
        if (live)
          setError(
            "We couldn’t load your payment options. Please open your orders or appointments.",
          );
      });
    return () => {
      live = false;
    };
  }, []);
  const item = items?.find((i) => `${i.kind}:${i.id}` === selected);
  async function confirm() {
    if (!item || lock.current || sent) return;
    const normalized = phone.replace(/\s+/g, "");
    if (!/^(?:\+?254|0)?[17]\d{8}$/.test(normalized)) {
      setError("Please enter a valid Kenyan M-Pesa number.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    if (
      !attempt.current ||
      attempt.current.selection !== selected ||
      attempt.current.phone !== normalized
    )
      attempt.current = {
        selection: selected,
        phone: normalized,
        key: crypto.randomUUID(),
      };
    try {
      if (item.kind === "order") {
        const fresh = await ordersApi.get(item.id);
        if (!orderCanBePaid(fresh) || !reviewAmount(item.amount, fresh.total))
          throw new Error(
            "This order changed. Please review it in My orders before paying.",
          );
      }
      if (item.kind === "booking") {
        const fresh = (await serviceBookingsApi.mine()).find(
          (b) => b.id === item.id,
        );
        if (
          !fresh ||
          !bookingCanBePaid(fresh) ||
          !reviewAmount(item.amount, fresh.price)
        )
          throw new Error(
            "This appointment changed. Please review it in My appointments before paying.",
          );
      }
      const response =
        item.kind === "order"
          ? await paymentsApi.mpesaInitiate(
              item.id,
              normalized,
              attempt.current.key,
            )
          : await servicePaymentsApi.mpesa(
              item.id,
              normalized,
              attempt.current.key,
            );
      setSent({ checkoutRequestId: response.checkoutRequestId, item });
      setPaymentStatus(
        "Request sent. Complete the M-Pesa prompt on your phone, then check the status here. Never enter your PIN in chat.",
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The request outcome is unclear. Check your orders before trying again.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function check() {
    if (!sent || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const response =
        sent.item.kind === "order"
          ? await paymentsApi.mpesaQuery(sent.checkoutRequestId)
          : await servicePaymentsApi.status(sent.item.id);
      const status =
        "paymentStatus" in response ? response.paymentStatus : response.status;
      setPaymentStatus(
        ["PAID", "SUCCESS"].includes(status)
          ? "Payment confirmed. Thank you—your payment status is now updated."
          : status === "FAILED"
            ? "The payment wasn’t completed. Open your order or appointment to review the next step."
            : "Your payment is still awaiting confirmation. You can check again shortly.",
      );
    } catch {
      setPaymentStatus(
        "We couldn’t check the status yet. Please view your order or appointment before making another payment.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function openOrders() {
    useAppStore.getState().navigate("orders");
    onNavigate();
  }
  return (
    <>
      <h3>A little help with payment.</h3>
      <p>
        Select a payable order or appointment. Check the amount and phone number
        before sending a prompt.
      </p>
      {!items && !error && <p role="status">Loading your payment options…</p>}
      {items && items.length === 0 && (
        <p>
          No payable items were found. Orders awaiting pharmacist review won’t
          appear here.
        </p>
      )}
      {!!items?.length && (
        <>
          <label>
            Pay for
            <select
              value={selected}
              disabled={busy || !!sent}
              onChange={(e) => {
                setSelected(e.target.value);
                setError("");
              }}
            >
              <option value="">Choose an order or appointment</option>
              {items.map((i) => (
                <option key={`${i.kind}:${i.id}`} value={`${i.kind}:${i.id}`}>
                  {i.description} · {i.reference} · {formatKES(i.amount)}
                </option>
              ))}
            </select>
          </label>
          <label>
            M-Pesa phone number
            <input
              type="tel"
              autoComplete="tel"
              value={phone}
              disabled={busy || !!sent}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0712 345 678"
            />
          </label>
          {item && (
            <p className="sphere-ai-review">
              Pay Medivyx {formatKES(item.amount)} for {item.reference}.
              An M-Pesa approval prompt will be sent to{" "}
              {phone || "the number you enter"}.
            </p>
          )}
          {!sent && (
            <button
              className="sphere-ai-confirm"
              disabled={!item || !phone || busy}
              onClick={confirm}
            >
              {busy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CreditCard size={16} />
              )}{" "}
              Send M-Pesa prompt{item ? ` · ${formatKES(item.amount)}` : ""}
            </button>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {sent && (
        <>
          <p role="status">{paymentStatus}</p>
          <button className="sphere-ai-confirm" onClick={check} disabled={busy}>
            Check payment status
          </button>
        </>
      )}
      <button onClick={openOrders} className="sphere-ai-other-option">
        View my orders / other payment options <ArrowUpRight size={15} />
      </button>
    </>
  );
}
