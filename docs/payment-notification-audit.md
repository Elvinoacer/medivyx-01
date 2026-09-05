# Payment and notification audit — 5 September 2026

## Verdict

**Not yet production-ready.** This is a source/configuration audit with implementation hardening, not a live-provider certification. No tests, transactions, push messages, or emails were triggered. TypeScript is checked statically. The local environment has both payment providers in sandbox mode and lacks `MPESA_CALLBACK_TOKEN`, `CRON_SECRET`, and `RESEND_WEBHOOK_SECRET`. Firebase browser/server values are present; their correctness, project alignment, permissions, sender authorization, domain verification, and device delivery have not been established.

The notification schema migration and scheduler configuration below are required before deploying these source changes. No database migration or production deployment was performed during this audit.

## Payment findings and changes

| Area | Assessment |
| --- | --- |
| Cards | Hosted IntaSend checkout is the correct existing architecture. The app does not need to collect card details. Fixed documented API origin/public-key header, explicit card method, checkout URL validation, callback challenge verification, and per-attempt `api_ref` matching. Returning from checkout never establishes payment success. |
| Card retries | The order flow previously lost the checkout URL on retry. It now persists/reuses that URL while processing. New and concurrent attempts are reserved under serializable isolation across online payment methods. |
| Order eligibility | Customer payment endpoints previously lacked payable-status checks. They now require pharmacy-confirmed `AWAITING_PAYMENT`, a positive amount, current amount matching, and reviewed prescriptions. Staff requests retain their separately authorized fulfillment-stage eligibility. |
| M-Pesa STK | Existing callback token, provider status verification, receipt/amount/phone checks, and transactional updates are useful protections. Added request timeouts, callback-token injection for configured URLs, HTTPS enforcement in production, shared attempt reservation, and preservation of uncertain outcomes. A network timeout no longer claims that no money was taken. |
| Callback replay | Terminal refunds can no longer be changed back to successful payment by a repeated collection callback. Success/failure notifications are queued atomically with callback state changes. Equivalent provider events are not rejected merely because JSON serialization changed. |
| Cash pickup/delivery | Existing staff authorization, rider assignment checks, prescription checks, and audit history remain. Cash confirmation now refuses unresolved online attempts inside its transaction. Its payment notifications also share that transaction. |
| Pay at pharmacy (services) | This records an intention, not money received. It now guards concurrent online payment, preserves paid state, and queues customer/staff notices transactionally. A dedicated staff settlement/receipt flow for service cash is still required. |
| Paybill/bank/other methods | A label or selected payment preference is not reconciliation. No complete independent Paybill/C2B or bank reconciliation flow was found. Do not advertise them as automatically verified methods. |
| Refunds | Cash refunds require administrator confirmation. M-Pesa reversals remain an external/manual process. IntaSend completion recognition was narrowed to documented `COMPLETED`; automatic refund creation still needs the concurrency/reconciliation work below. |

### Remaining payment release blockers

1. **Missing-callback recovery:** status endpoints currently read local state. Add durable callback ingestion/retry and scheduled provider reconciliation. Daraja success queries alone do not provide all receipt/amount/phone evidence required by the existing verifier. Missing/early callbacks and provider verification outages need a recovery path, not an assumption that payment failed.
2. **Uncertain initiation:** requests that lose a provider response intentionally remain processing. Build an authenticated reconciliation workflow for these attempts before permitting replacement attempts. Do not reset these rows simply because a timer expired.
3. **Historical/late payments:** resolve legacy checkout IDs separately from invoice IDs. New card sessions use unique local payment-attempt references, but old sessions may still need reconciliation. Payments arriving after cancellation/stock release, or a second historical attempt settling, need a staff exception/refund process. A unique loyalty award must not prevent recording a second real capture.
4. **Refund requests:** reserve a refund operation before network I/O and reconcile uncertain responses; concurrent administrators or response loss can currently issue duplicate external refund requests. Support provider chargeback events/reconciliation and service refunds. Do not infer refund success from a checkout redirect or broad status-name guesses.
5. **In-store service settlement:** add an authorized cash receipt endpoint and corresponding staff UI. `PAY_AT_PHARMACY` remains unpaid until actual collection is recorded.
6. **Deployment configuration:** use approved live merchant credentials, matching webhook challenges, correct shortcode/transaction type, public HTTPS callbacks, verified merchant account capabilities, and monitored schedules. None was certified by this audit.

## Notification implementation

`notifyCustomer` and `notifyStaff` now write an inbox entry and durable `NotificationDelivery` jobs together. Each email recipient and each registered device gets a separate job. No outbound provider call happens while recording the notification. Staff email recipients are sent separately, avoiding disclosure of staff addresses to each other.

The authenticated dispatcher provides claim leases, bounded retries with exponential backoff, independent channel outcomes, preference checks at delivery time, recipient/device ownership checks, and terminal failure records. An expired lease is reclaimable after a process crash. Resend retries use a stable idempotency key and stop before its 24-hour deduplication guarantee expires. `SENT` means provider acceptance; it is not proof of inbox/device receipt.

Signed Resend events are persisted before acknowledgment, including events arriving before a send response is saved. The dispatcher reconciles delivered, bounced, complained, and failed states. Bounce/complaint addresses are suppressed from future queued email. An administrator must review the provider result before removing suppression or retrying uncertain/expired deliveries. Do not blindly reset failed jobs.

Push fixes include absolute same-origin click targets, privacy-preserving lock-screen copy, stable notification tags, pruning only confirmed unregistered tokens, strict partial-failure reporting, request timeouts, and device ownership rechecks. The shared bell/inbox is available in the site header for both customers and staff, refreshes while visible, and opens the notification destination. Account settings now expose a direct “Enable push on this device” action; storing a preference alone does not grant browser permission or register a device. Logout removes that device registration from the account. Existing granted registrations are refreshed on authenticated app startup.

### Coverage

Existing order creation/status/delivery/cancellation, prescription upload/review/refill request, stock alert, low-stock staff alert, refund notice, service booking/status/reschedule, and rider assignment calls now use the queue through the shared notifier. Added transactional online payment success/failure and cash payment notices, service pay-at-pharmacy notices, and service assignee alerts. Appointment reminders include rescheduled bookings and use stable keys containing the scheduled time; retrying queue insertion no longer permanently loses a reminder to an unreleased claim.

There is still a commit-to-enqueue gap in older business routes that invoke the shared notifier **after** their business transaction. Payment callbacks, cash confirmation, and service payment-method selection were moved inside their transactions. Completing that migration for all legacy order/prescription/booking mutations, or adding event-history reconciliation, is required for a strict end-to-end no-lost-event guarantee. The queue guarantees durability once enqueued, not before the notifier is called.

SMS OTP uses its existing synchronous Africa’s Talking adapter and checks provider acceptance. General transactional SMS/automated WhatsApp are not implemented by this queue; do not represent preference flags or click-to-chat links as delivery integrations. No dosage-based refill reminders were inferred or invented.

## Deployment and operation

1. Review and apply `prisma/migrations/20260905100000_notification_delivery/migration.sql` using the normal `prisma migrate deploy` release workflow, then generate Prisma Client and build the application. It adds `NotificationDelivery`, `EmailSuppression`, and `EmailDeliveryEvent` only.
2. Configure `NEXT_PUBLIC_APP_URL` as the actual HTTPS origin. Configure a verified `RESEND_FROM_EMAIL`, `RESEND_API_KEY`, and Resend signing secret `RESEND_WEBHOOK_SECRET`.
3. Register `POST /api/notifications/email-webhook` in Resend for `email.delivered`, `email.bounced`, `email.complained`, and `email.failed`.
4. Configure a random `CRON_SECRET` of at least 32 characters. Invoke `GET /api/cron/notifications` every minute with `Authorization: Bearer <CRON_SECRET>`. Each invocation handles up to ten jobs, with a 300-second execution budget; the hosting plan must support this. Scale worker cadence/concurrency based on backlog and provider quotas. Claim leases prevent workers from taking the same current job.
5. Keep the appointment-reminder job scheduled at least every 15 minutes with the same authorization. Its time windows still depend on scheduler uptime; outages longer than the reminder window need a catch-up policy.
6. Configure matching Firebase browser project/sender/app identifiers, Web Push VAPID key, and server service-account credentials authorized for FCM HTTP v1. HTTPS and explicit browser permission are required. Unsupported browsers cannot receive Web Push.
7. Monitor administrator-only `GET /api/admin/notification-health` for pending age, per-channel status counts, terminal failures and missing configuration. It exposes no message bodies, email addresses, or device tokens. Wire those signals to deployment monitoring; no external monitor was created here.
8. Apply a retention policy to sent jobs/provider events because queued payloads contain recipient details/device tokens. Retain terminal failures for investigation, and protect access to these database tables. Provider-accepted pushes remain best-effort device delivery; a send response is not a receipt from the device.

## Primary references reviewed

- [IntaSend hosted checkout links](https://developers.intasend.com/docs/checkout-links)
- [IntaSend create checkout API](https://developers.intasend.com/reference/api_v1_checkout_create)
- [IntaSend webhook setup/challenge](https://developers.intasend.com/docs/setup)
- [IntaSend payment events](https://developers.intasend.com/docs/payment-collection-events)
- [IntaSend invoice/checkout status API](https://developers.intasend.com/reference/api_v1_payment_status_create)
- [IntaSend chargeback states](https://developers.intasend.com/docs/chargeback-events)
- [FCM error codes](https://firebase.google.com/docs/cloud-messaging/error-codes)
- [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys)
- [Resend webhook verification](https://resend.com/docs/webhooks/verify-webhooks-requests)
- [Svix signature construction](https://docs.svix.com/receiving/verifying-payloads/how-manual)
