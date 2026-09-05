// These checks prepare the UI; authenticated payment endpoints remain authoritative.
export function orderCanBePaid(order: {
  status: string;
  total: number;
  payments: { status: string }[];
}): boolean {
  return (
    order.status === "AWAITING_PAYMENT" &&
    Number.isFinite(order.total) &&
    order.total > 0 &&
    !order.payments.some((p) =>
      ["SUCCESS", "PROCESSING", "PENDING"].includes(p.status),
    )
  );
}
export function bookingCanBePaid(booking: {
  status: string;
  price?: number | null;
  paymentStatus: string;
}): boolean {
  return (
    ["PENDING", "CONFIRMED", "RESCHEDULED", "ARRIVED", "IN_PROGRESS"].includes(
      booking.status,
    ) &&
    ["UNPAID", "FAILED"].includes(booking.paymentStatus) &&
    Number.isFinite(Number(booking.price)) &&
    Number(booking.price) > 0
  );
}
export function reviewAmount(expected: number, actual: unknown): boolean {
  return (
    Number.isFinite(expected) && expected > 0 && Number(actual) === expected
  );
}
