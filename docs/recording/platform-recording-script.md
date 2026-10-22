# Sphere Pharmacy platform recording script

Prepared 22 October 2026. This guide covers the current customer, admin, pharmacist, counter-staff and rider interfaces. Use each scene as a separate take, with the click, purpose, expected result and caption beside the action.

The guide is based on the current interface source and server workflow checks. It is a filming script, not a claim that every deployed integration has been rehearsed. Use the preflight notes before recording.

## Recording setup

1. Use a rehearsal environment with demo customers, staff and orders. Keep separate browser profiles for Customer, Admin, Pharmacist, Staff and Rider; one profile shares one session cookie.
2. Use a pharmacy-controlled recording phone number and email. Mark prescription images DEMO and remove real patient names, addresses, phone numbers, medicine history, credentials and payment details from the recording.
3. Prepare: an in-stock OTC product, a prescription-only product, an out-of-stock listing, a low-stock listing, a unique product SKU, a small CSV, a JPG under 3MB, and a DEMO prescription PDF under 10MB.
4. Prepare an active service with future hours, an available slot, a paid delivery assigned to a rider, an unpaid cancellable order, a completed order, a completed service visit and a customer with redeemable points.
5. For online-payment and OTP success takes, verify the providers in rehearsal first. Use approved test workflows. Hide all PIN, password, OTP, card and authentication entry. A missing provider is a conditional take, not a successful payment.
6. Record desktop at a consistent viewport and 100% browser zoom. Record mobile navigation separately. Enable the cursor highlight in your recording tool and close unrelated tabs and notifications.
7. Record one journey per clip. Move the cursor to the control, click once, wait for the result, then hold the completed screen for 3 seconds. Allow about 4-6 seconds per short caption and extend holds for longer text.
8. Use scene and step IDs to name clips and captions, for example P04_03_phone-number. Captions are screen-text suggestions; timings must be set against the footage after recording.

## Recommended capture order

- **Prepare before filming:** Set up demo users and products; set service hours; choose an open slot; prepare paid, unpaid and completed order fixtures. Keep a separate copy for destructive branches.
- **Customer discovery:** Record P01-P06, C01-C09 and H01. Keep requests, reviews and stock alerts for the admin follow-up scenes.
- **Create the handoff records:** Record O01, O02, O05, X01, X02 and S01. Write down every order, prescription and booking reference before switching roles.
- **Staff follow-up:** Record A01-A06, A11 and A12 using the same references. Prepare payment-ready Rx orders before returning to the customer payment scenes.
- **Customer outcomes and rider:** Record O03, O04, O06, X03, S02, S03, H02, H03 and R01 after their preconditions exist.
- **Owner tools and role tour:** Record A07-A10 and A13-A18, then T01-T02. Use fresh demo data for edits, imports, deactivation, archival and deletion.

## Main story and extended coverage

For a shorter overview, use these core scenes: P01, P02, P03, C01, C03, O01, A01, A02, O06, P04, P05, A06, X02, A04, X03, S01, A11, S03, A03, R01. Expect roughly 15-20 minutes after editing. For the complete library, record every scene as separate modules; allow roughly 45-70 minutes of edited material, depending on pauses and payment waits. These are planning estimates, not subtitle timings.

Suggested opening caption: "Sphere Pharmacy brings product discovery, prescription review, appointments and pharmacy operations into one platform."

Suggested closing caption: "Customers, pharmacy teams and riders follow each request through the same platform."

## Journey index

| Scene | Role | Journey |
| --- | --- | --- |
| P01 | Guest | Homepage and navigation |
| P02 | Guest | Find and filter products |
| P03 | Guest or Customer | Product details and saved items |
| P04 | Guest | Request a missing medicine without a photo |
| P05 | Guest | Request a medicine with a photo |
| P06 | Guest | Questions and pharmacy contact |
| C01 | Customer | Create an account and sign in |
| C02 | Customer | Sign in with a phone code |
| C03 | Guest becoming Customer | Cart review and sign-in return |
| C04 | Customer | Profile and account security |
| C05 | Customer | Save and manage delivery addresses |
| C06 | Customer or Staff | Updates and notification preferences |
| C07 | Customer | Back in stock alerts |
| C08 | Customer | Sphere Points and redemption |
| C09 | Customer | Write a product review |
| O01 | Customer | Place a cash pickup order |
| O02 | Customer | Place a delivery order |
| O03 | Customer | Pay an order with M Pesa |
| O04 | Customer | Pay an order by card |
| O05 | Customer | Reserve items for collection |
| O06 | Customer | Track cancel and reorder |
| X01 | Customer | Upload a prescription for review |
| X02 | Customer | Order prescription medicines |
| X03 | Customer | Prescription outcomes and refills |
| S01 | Customer | Browse services and book an appointment |
| S02 | Customer | Choose appointment payment |
| S03 | Customer | Track an appointment and review a visit |
| H01 | Guest or Customer | Find products with the assistant |
| H02 | Customer | Book through the assistant |
| H03 | Customer | Pay through the assistant |
| A01 | Admin | Staff sign in and daily overview |
| A02 | Admin or permitted pharmacy staff | Process an order to pickup |
| A03 | Admin or permitted dispatch staff | Assign and dispatch a delivery |
| A04 | Pharmacist or Admin | Review and approve a prescription |
| A05 | Pharmacist or Admin | Clarify partially approve or reject a prescription |
| A06 | Admin Pharmacist or Staff | Manage medicine requests |
| A07 | Admin Pharmacist or Staff | Update existing products and stock |
| A08 | Admin | Create a product and choose its images |
| A09 | Permitted catalogue staff | Import products from CSV |
| A10 | Admin Pharmacist or Staff | Publish a service and set booking hours |
| A11 | Admin Pharmacist or Staff | Run the appointment workflow |
| A12 | Admin Pharmacist or Staff | Reschedule and cancel appointments |
| A13 | Admin or Pharmacist | Moderate product reviews |
| A14 | Admin or Staff | Create and use a promotion |
| A15 | Admin | Manage staff accounts and roles |
| A16 | Admin | Reports service analytics and audit activity |
| A17 | Admin with Pharmacist view only | Compliance information |
| A18 | Admin | Pharmacy settings and delivery pricing |
| R01 | Rider | Complete an assigned delivery |
| T01 | Pharmacist | Pharmacist workspace and access boundaries |
| T02 | Staff | Counter staff workspace and access boundaries |

## P01 Homepage and navigation

**Role:** Guest  
**Navigation:** /  
**Purpose:** Introduce the pharmacy and the main customer destinations.  
**Before recording:** Start signed out on the current homepage. Use the desktop header first, then show the mobile menu as a separate take.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| P01.01 | Open the homepage and hold for 3 seconds. | Establish the brand and location before navigating. | Welcome to Sphere Pharmacy in Roysambu. |
| P01.02 | Click Find your feel-good. | Open the product catalogue. | Browse medicines and everyday health essentials. |
| P01.03 | Click the Sphere Pharmacy logo. | Return home using the shared navigation. | Return home from any screen. |
| P01.04 | Click Care services in the header; on mobile use Services. | Open the service catalogue. | Explore pharmacy care services. |
| P01.05 | Open navigation, then choose My account; on desktop use the account icon. | Show the customer account entry point. | Keep orders, prescriptions and appointments together. |

**Recorder note:** The current homepage uses SphereLanding. Use its visible controls, rather than labels from older homepage designs.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## P02 Find and filter products

**Role:** Guest  
**Navigation:** /catalog  
**Purpose:** Show how a shopper narrows the catalogue to a suitable listing.  
**Before recording:** Have several active products across categories, with different prices and stock states.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| P02.01 | Click Shop health or mobile Shop, then type a known product in Search products. | Show matching listings after the search finishes. | Find a medicine by name, ingredient or brand. |
| P02.02 | Clear search, then select a category ribbon item. | Narrow the visible catalogue to a category. | Browse products by category. |
| P02.03 | Use the desktop filter sidebar or mobile Filters; choose prescription and availability filters. | Demonstrate filtering by product type and stock. | Check prescription requirements and availability. |
| P02.04 | Change Sort by, then use Grid view and List view. | Compare results in different orders and layouts. | Compare products in the view that suits you. |
| P02.05 | Choose Numbered page navigation and move to another page; also show the auto-scrolling mode if there are enough items. | Explain how to browse larger result sets. | Browse more products without losing your filters. |
| P02.06 | Click Clear all filters. | Restore the full catalogue. | Start a fresh search at any time. |

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## P03 Product details and saved items

**Role:** Guest or Customer  
**Navigation:** /catalog -> /products/<productId>  
**Purpose:** Help the shopper inspect a listing before adding it to the cart.  
**Before recording:** Use an in-stock non-prescription demo product with an image, description and warnings.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| P03.01 | Click a product card or its name. | Open product details and show price, pack size and stock. | Check the product details before you buy. |
| P03.02 | Scroll through the description, How to use and Warnings & precautions. | Show the information supplied with the listing. | Review the product information and cautions. |
| P03.03 | Click the heart labelled Save for later; click it again to remove the saved state if needed. | Demonstrate the saved-item toggle on this device. | Save a product for later. |
| P03.04 | Use Increase quantity, then click Add to cart. | Add the selected quantity and show the cart count update. | Add the packs you need to your cart. |
| P03.05 | Show Buy now and Order via WhatsApp as alternative actions. | Explain the faster purchase and contact entry points. | Choose checkout or ask the pharmacy for help. |

**Recorder note:** The active header does not expose the older wishlist drawer. Show the heart toggle, without promising a separate saved-items screen.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## P04 Request a missing medicine without a photo

**Role:** Guest  
**Navigation:** /catalog  
**Purpose:** Show the simplest missing-medicine enquiry from customer to staff.  
**Before recording:** Use a made-up medicine description and a pharmacy-controlled recording phone number.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| P04.01 | Search for a demo medicine that is not in the catalogue. | Show the empty results and the request option above them. | Cannot find your medicine? Send us a request. |
| P04.02 | Click Request medicine. | Open the request form with the search text prefilled. | Tell us which medicine you need. |
| P04.03 | Review Medicine name and enter Phone number. | Supply a clear medicine description and callback number. | Leave a number where our team can reach you. |
| P04.04 | Leave Medicine photo empty, then click Send request. | Demonstrate that the photo and account sign-in are optional. | A photo is optional. No account is required. |
| P04.05 | Hold on Your request has been received, then click Done. | Capture the success state before closing. | Your request is saved for pharmacy follow-up. |

**Recorder note:** Keep the request NEW for A06. Submitting a request does not place an order or guarantee availability.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## P05 Request a medicine with a photo

**Role:** Guest  
**Navigation:** /catalog  
**Purpose:** Show the optional image path and useful validation feedback.  
**Before recording:** Prepare a JPG, PNG or WebP of a demo medicine pack under 3MB, with no patient information.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| P05.01 | Click Request medicine and enter a medicine name and callback number. | Prepare a second enquiry for the photo branch. | Add a medicine name and your callback number. |
| P05.02 | Click Medicine photo and choose the prepared image. | Attach an optional reference photo. | A pack photo can help our team identify the medicine. |
| P05.03 | Show Remove photo, then reselect the image if demonstrating that control. | Demonstrate how to change an attachment before submitting. | Change or remove the photo before sending. |
| P05.04 | Click Send request and hold on the confirmation. | Capture a successful request with an attachment. | Your medicine request and photo have been received. |
| P05.05 | In a separate take, enter an invalid phone or select an oversized image. | Show the form asking for a correction. | Clear guidance helps you correct the request. |

**Recorder note:** Photo limit: JPG, PNG or WebP, up to 3MB. The image is viewable only by permitted pharmacy staff. Do not mix the error take into the main success take.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## P06 Questions and pharmacy contact

**Role:** Guest  
**Navigation:** /  
**Purpose:** Show where people find basic answers and reach the pharmacy team.  
**Before recording:** Keep external messaging apps closed until you are ready to capture the handoff.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| P06.01 | Scroll to the homepage questions and open a question. | Reveal the answer in the FAQ accordion. | Find quick answers before contacting the pharmacy. |
| P06.02 | Click Let's talk in the header or the visible WhatsApp contact link. | Show the handoff to a prefilled WhatsApp conversation. | Speak directly with the pharmacy team. |
| P06.03 | Return to the site and show the phone link in the catalogue footer. | Show the call handoff without placing a call during the take. | Call the pharmacy when you need personal help. |
| P06.04 | Show the Roysambu location link or Get directions. | Open the map destination for the pharmacy. | Find Sphere Pharmacy on Lumumba Drive. |

**Recorder note:** Opening a WhatsApp link prepares a conversation; it does not mean the platform has sent a message. Capture only the handoff unless a demonstration conversation is arranged.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## C01 Create an account and sign in

**Role:** Customer  
**Navigation:** /account -> /auth  
**Purpose:** Introduce registration and the standard returning-customer sign-in.  
**Before recording:** Use a dedicated demo customer. Have a controlled phone and optional recording email; keep passwords out of the published video.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| C01.01 | Open My account and click Create account, or choose Register on the auth screen. | Open the registration form. | Create your Sphere Pharmacy account. |
| C01.02 | Enter Full name, Phone number, optional Email and Choose a password. | Complete the registration fields with demo details. | Save your details for future visits. |
| C01.03 | Click Create account and wait for the account view. | Capture successful account creation and the signed-in identity. | Your account is ready. |
| C01.04 | For a separate returning-user take, sign out, choose Sign in, and enter Email or phone number and Password. | Demonstrate the normal sign-in form. | Sign in with your email address or phone number. |
| C01.05 | Click Sign in and hold on the account overview. | Show the customer session is active. | Continue with your saved account details. |

**Recorder note:** Use a password of at least 10 characters containing letters and numbers. Some older help text says six; the server policy is stricter. Pre-create the account before the main recording if registration is not part of the final edit.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## C02 Sign in with a phone code

**Role:** Customer  
**Navigation:** /auth -> Phone OTP  
**Purpose:** Show the phone verification alternative to password sign-in.  
**Before recording:** Have access to a controlled phone and a working SMS setup. Do not publish the verification code.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| C02.01 | Open the auth screen and click Phone OTP. | Switch to the phone-code sign-in tab. | Sign in using a code sent to your phone. |
| C02.02 | Enter Phone number and click Send code. | Request a six-digit verification code. | Request your verification code. |
| C02.03 | Cut away while receiving the SMS, then enter the six-digit code. | Demonstrate verification without exposing the code. | Verify your phone number securely. |
| C02.04 | If shown, enter Your name for a new customer; click Verify & continue. | Finish verification and enter the customer account. | Continue to your Sphere account. |

**Recorder note:** Film this branch only when SMS delivery is configured. Do not use an old README claim that a production screen reveals demo OTP codes.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## C03 Cart review and sign-in return

**Role:** Guest becoming Customer  
**Navigation:** /cart -> /auth?next=checkout -> /checkout  
**Purpose:** Explain the real cart-to-checkout journey and cart preservation.  
**Before recording:** Start signed out with two in-stock demo products in the cart.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| C03.01 | Click the shopping bag icon or mobile Cart. | Open the cart and display its line items and subtotal. | Review your cart before checkout. |
| C03.02 | Increase or decrease a quantity; remove one optional line. | Show quantities and totals updating. | Adjust quantities or remove an item. |
| C03.03 | Click Proceed to checkout while signed out. | Capture the current redirect to sign-in. | Sign in to continue with your saved cart. |
| C03.04 | Sign in with the demo customer account. | Return to checkout with the original cart. | Your cart stays with you as you sign in. |
| C03.05 | Hold on Fulfillment and the order summary. | Confirm checkout is ready to continue. | Choose pickup or delivery next. |

**Recorder note:** Although some cart copy mentions guest checkout, the current Proceed to checkout action requires customer sign-in. Continue as guest on the auth page returns home. Do not record a normal guest-purchase success as if it is reachable through this button.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## C04 Profile and account security

**Role:** Customer  
**Navigation:** /account  
**Purpose:** Show how a customer maintains personal details and credentials.  
**Before recording:** Use a demo account and a generic avatar image. Plan to cut all password entry.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| C04.01 | Open My account, then Profile -> Edit. | Enter profile-edit mode. | Keep your account details up to date. |
| C04.02 | Change Full name, Phone or Email, and optionally select the profile photo control. | Demonstrate editable contact information and avatar. | Make your account easy to recognise. |
| C04.03 | Click Save changes and hold on the updated profile. | Confirm the edited details have saved. | Your updated profile is saved. |
| C04.04 | Open Change password and fill Current password, New password and Confirm new password off-camera. | Show the password-change controls without revealing credentials. | Update your password when you need to. |
| C04.05 | Click Update password, then show Sign out under Security & data. | Demonstrate the end of the session as a separate take. | Sign out when you finish on a shared device. |

**Recorder note:** Download my data is disabled and labelled Coming soon. It is not a completed data-export journey.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## C05 Save and manage delivery addresses

**Role:** Customer  
**Navigation:** /account -> Saved addresses  
**Purpose:** Show reusable delivery details for faster checkout.  
**Before recording:** Use a fictional recording address within a configured delivery zone.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| C05.01 | Open Saved addresses and click Add address or Add your first address. | Open the address form. | Save an address for your next delivery. |
| C05.02 | Enter Label and Full address, then choose Delivery zone. | Give the address a recognisable name and delivery area. | Keep delivery details clear and easy to find. |
| C05.03 | Add Rider notes if useful; enable Default address. | Record directions and the preferred checkout address. | Add directions and choose your default address. |
| C05.04 | Click Add address and hold on the saved address card. | Confirm the address is available for reuse. | Your address is ready for checkout. |
| C05.05 | Click Edit to update it; in a separate take click Remove and show Keep address or the removal confirmation. | Demonstrate maintenance without deleting the main recording address. | Edit or remove a saved address when needed. |

**Recorder note:** If showing the location button, use a prepared test location or capture only the permission explanation. Keep precise personal location out of the recording.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## C06 Updates and notification preferences

**Role:** Customer or Staff  
**Navigation:** /account and header Notifications  
**Purpose:** Show the customer inbox and the notification controls currently visible.  
**Before recording:** Prepare at least one unread demo notification. Use a browser where permission prompts can be recorded cleanly.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| C06.01 | Click the bell labelled Notifications. | Open Your updates and show an unread entry. | See order, payment and appointment updates in one place. |
| C06.02 | Click an update. | Mark the entry read and open its linked destination. | Open an update to see the relevant details. |
| C06.03 | Return to My account -> Notification channels. | Show the email preference control and always-on in-app channel. | Choose whether to receive email updates. |
| C06.04 | Toggle Email notifications and show the saved state. | Demonstrate the visible preference. | Update your email notification preference. |
| C06.05 | Click Enable push on this device and show the browser permission flow; include Turn push off if already enabled. | Explain device-level push permission and the account preference. | Enable alerts on this browser if you want them. |

**Recorder note:** The current account UI exposes Email and push controls. Do not promise SMS or WhatsApp preference switches from older documentation. Delivery of email or push also depends on the environment configuration.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## C07 Back in stock alerts

**Role:** Customer  
**Navigation:** /products/<outOfStockProductId> -> /account  
**Purpose:** Show a stock alert for a listed product, distinct from a missing-medicine request.  
**Before recording:** Prepare an active OUT_OF_STOCK demo product with zero quantity. Keep it listed.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| C07.01 | Open the out-of-stock product. | Show that ordinary add-to-cart actions are unavailable. | This listed product is currently out of stock. |
| C07.02 | Click Notify me when back in stock; sign in if prompted. | Register the customer stock alert. | Ask to be notified when this product returns. |
| C07.03 | Hold on Alert set, then open My account and locate the stock watchlist. | Show the alert is attached to the account. | Your stock alert is saved. |
| C07.04 | After A07 restocks the same product, refresh the product and customer updates. | Show current stock and any generated alert that is actually present. | Check availability again when stock is updated. |

**Recorder note:** Do not promise an SMS or email unless it was actually delivered. Medicine requests are for an enquiry; stock alerts watch a specific existing product.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## C08 Sphere Points and redemption

**Role:** Customer  
**Navigation:** /account -> /checkout  
**Purpose:** Show the loyalty balance, history and eligible checkout redemption.  
**Before recording:** Use a demo customer with enough points for redemption and a cart large enough to meet the minimum.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| C08.01 | Open My account -> Sphere Points. | Show the balance, Earned and Redeemed values. | See your Sphere Points balance. |
| C08.02 | Open or scroll through Points history and click an order reference. | Connect the points entry to its source order. | Review where your points came from. |
| C08.03 | Return to checkout and find the Sphere Points redemption switch in the order summary. | Show the available redemption quote when eligible. | Use eligible points toward your order. |
| C08.04 | Enable redemption and hold on the changed total. | Capture the discount and payable amount. | Review your updated total before confirming. |
| C08.05 | After a genuinely successful payment, return to Sphere Points and refresh. | Show only the balance and history the server recorded. | Your points history reflects completed account activity. |

**Recorder note:** Current constants: 1 point per KSh100, KSh1 per point, at least 100 points to redeem, capped at 25% of the eligible subtotal. Do not promise points from an unpaid order.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## C09 Write a product review

**Role:** Customer  
**Navigation:** /products/<productId>  
**Purpose:** Show ratings and customer feedback on a product.  
**Before recording:** Use a signed-in demo customer and a product without an existing review by that customer.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| C09.01 | Open a product and scroll to Customer reviews. | Show the rating summary and existing feedback. | Read customer feedback on this product. |
| C09.02 | Open Write a review or the visible review form. | Enter the signed-in review area. | Share your experience with the product. |
| C09.03 | Select a star rating and type a short demo comment. | Prepare the rating and optional text. | Add a rating and useful feedback. |
| C09.04 | Click Submit review and hold on the confirmation. | Capture successful submission. | Your review has been submitted. |
| C09.05 | Keep this review available for A13 moderation. | Link the customer scene to staff moderation. | The pharmacy can moderate product reviews. |

**Recorder note:** Do not caption the review as a verified purchase unless the live system explicitly verifies that claim. A customer can submit only one review per product.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## O01 Place a cash pickup order

**Role:** Customer  
**Navigation:** /cart -> /checkout  
**Purpose:** Record a complete order-placement journey that does not depend on an online gateway.  
**Before recording:** Sign in, add an in-stock non-prescription demo product, and keep a second admin browser ready.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| O01.01 | Click Proceed to checkout and choose Store pickup on Fulfillment. | Select collection from the pharmacy with no delivery address. | Choose free pickup from the pharmacy. |
| O01.02 | Click Continue and review Details; add optional Order notes. | Confirm the account and collection information. | Check your details before placing the order. |
| O01.03 | Click Continue to payment, then choose Cash. | Select payment on collection. | Pay in cash when you collect your order. |
| O01.04 | Click Place order and hold on the confirmation and reference. | Capture order placement, without claiming payment is complete. | Your pickup order has been placed. |
| O01.05 | Click Track order. | Open the order status and history. | Follow the order until it is ready for pickup. |

**Recorder note:** Keep this order for A02. A cash-order confirmation is not proof that cash has been received. Show the pickup code only when the current order screen exposes it.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## O02 Place a delivery order

**Role:** Customer  
**Navigation:** /checkout -> Delivery  
**Purpose:** Show delivery-area selection, address entry and fee review.  
**Before recording:** Use a second in-stock non-prescription cart and the saved demo address from C05.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| O02.01 | Choose Delivery on Fulfillment, then select a delivery zone. | Calculate and display the quoted delivery fee. | Check delivery availability for your area. |
| O02.02 | Click Continue and select a saved address or enter a new Full address. | Set the delivery destination. | Choose where you want the order delivered. |
| O02.03 | Enter rider directions, then review delivery fee and order total. | Make the handoff location clear and show the full quote. | Review your address, delivery fee and total. |
| O02.04 | Continue to payment and choose the intended method; use Cash for a non-gateway placement take. | Explain the payment choice without marking the order paid. | Choose how you want to pay. |
| O02.05 | Place the order and open Track order. | Capture the delivery-order reference and current status. | Your delivery order is ready for pharmacy processing. |

**Recorder note:** Use a paid delivery fixture for the full dispatch journey in A03 and R01. The current server restricts progression of unpaid orders; rehearse cash-on-delivery fulfillment before promising a complete recorded COD lifecycle.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## O03 Pay an order with M Pesa

**Role:** Customer  
**Navigation:** /checkout or /orders/<orderId>  
**Purpose:** Show an M-Pesa request, its pending state and the verified outcome.  
**Before recording:** Use a non-prescription order at Awaiting payment, configured Daraja credentials, and an approved recording handset or sandbox workflow.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| O03.01 | Open an Awaiting payment order and choose M-Pesa; checkout also offers M-Pesa. | Show a payable order and its current amount. | Pay your order securely with M-Pesa. |
| O03.02 | Enter the controlled M-Pesa phone number and review the amount. | Confirm the payment destination and payable total. | Check the phone number and amount first. |
| O03.03 | Click the M-Pesa payment button and hold on the waiting state. | Show that a request has been sent, not a completed payment. | Approve the payment prompt on your phone. |
| O03.04 | Cut away for handset PIN entry, then return to the order after the provider confirms. | Capture the actual success status and payment record. | Payment is complete when confirmation is received. |
| O03.05 | If the provider declines or times out, show the failure message and check status before retrying. | Demonstrate recovery in a separate take. | Check the payment result before trying again. |

**Recorder note:** There is no website PIN-entry simulator in the current flow. Never use old fake-PIN instructions. If the gateway is not configured, record only the unavailable state and leave the success take pending.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## O04 Pay an order by card

**Role:** Customer  
**Navigation:** /checkout or /orders/<orderId> -> IntaSend  
**Purpose:** Explain the secure hosted card-payment handoff.  
**Before recording:** Use a payable demo order and a configured IntaSend sandbox or approved payment setup.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| O04.01 | Select Card on the payment screen. | Show the card-payment option and amount. | Choose card payment for your order. |
| O04.02 | Click Continue to IntaSend. | Leave Sphere for the provider-hosted checkout. | Card details are entered on IntaSend secure checkout. |
| O04.03 | Capture the hosted page with test data only; cut sensitive fields and authentication. | Explain the provider step without exposing payment details. | Complete the provider steps to authorise payment. |
| O04.04 | Return using the provider flow and open the same order. | Check the server-recorded payment outcome. | Your order shows the confirmed payment result. |
| O04.05 | If the result is pending, refresh or revisit the order instead of assuming success. | Show the difference between a redirect and verified payment. | Check the order status after payment. |

**Recorder note:** Do not enter card numbers or CVV into Sphere itself. A redirect or return to the site does not establish payment success.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## O05 Reserve items for collection

**Role:** Customer  
**Navigation:** /checkout -> Payment -> Reserve  
**Purpose:** Show an order reserved for later payment in store.  
**Before recording:** Use a separate non-prescription cart and select Store pickup.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| O05.01 | Choose Store pickup and complete Details. | Set up an in-store reservation. | Reserve items to collect at the pharmacy. |
| O05.02 | On Payment, choose Reserve. | Select the later-payment option. | Choose to pay in store. |
| O05.03 | Click Reserve items - pay in store. | Submit the reservation without an online charge. | Your reservation request is saved. |
| O05.04 | Hold on the confirmation, reference and Track order. | Give the recorder a clear reservation end state. | Keep your order reference for collection. |
| O05.05 | Open the reservation in Admin -> Orders in a separate take. | Show the reservation is available for processing. | Staff can manage the reservation in the order queue. |

**Recorder note:** The UI mentions a 24-hour hold. Confirm the recording environment's actual reservation expiry configuration before putting a precise deadline in the published caption.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## O06 Track cancel and reorder

**Role:** Customer  
**Navigation:** /orders -> /orders/<orderId>  
**Purpose:** Show the customer order list and its state-dependent actions.  
**Before recording:** Prepare one unpaid cancellable order, one active order and one completed order. Do not cancel the primary pickup or delivery recording order.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| O06.01 | Open My account -> Orders or Open navigation -> Track my orders. | Display the customer order history. | Find your current and previous orders. |
| O06.02 | Open an active order and scroll through status history, items, totals and payment records. | Show the detail behind the current status. | Follow each stage of your order. |
| O06.03 | On an Awaiting payment order, show Complete payment and its payment choices. | Demonstrate how a customer returns to pay. | Complete payment when your order is ready. |
| O06.04 | On a separate eligible unpaid order, click Cancel order; enter an optional reason and confirm cancellation. | Capture an allowed cancellation and its terminal status. | Cancel an eligible order before fulfillment. |
| O06.05 | Open the completed order, click Reorder these items, and confirm the cart action. | Recreate a cart for review rather than an automatic purchase. | Reorder previous items and review your cart again. |

**Recorder note:** Cancellation depends on order state. Do not promise automatic refunds: captured payments use a separate provider-refund process, and the current admin UI has no refund button.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## X01 Upload a prescription for review

**Role:** Customer  
**Navigation:** /prescriptions -> Upload new  
**Purpose:** Show a standalone prescription upload without placing an order.  
**Before recording:** Sign in and prepare a clearly marked DEMO prescription image or PDF under 10MB, with fictional patient details.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| X01.01 | Click Prescriptions or Upload prescription; sign in if prompted. | Open the customer prescription workspace. | Send your prescription to the pharmacy for review. |
| X01.02 | Click Upload new, then Browse files. | Choose the prepared image or PDF and show the preview. | Upload a clear photo or PDF of the prescription. |
| X01.03 | Optionally enter Notes for the pharmacist. | Add context for the review. | Add a note for the pharmacist if needed. |
| X01.04 | Click Upload for review; keep the progress and confirmation in shot. | Capture completed upload rather than the initial file selection. | Your prescription has been submitted for review. |
| X01.05 | Open My prescriptions and show Pending review. | Establish the customer-visible review state. | Follow the pharmacist review from your account. |

**Recorder note:** Standalone upload alone does not place or charge an order. Checkout currently uploads attachments within its own Details step; do not claim it has a picker for an existing standalone prescription.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## X02 Order prescription medicines

**Role:** Customer  
**Navigation:** /products/<rxProductId> -> /cart -> /checkout  
**Purpose:** Show the prescription requirement inside an order journey.  
**Before recording:** Prepare an active in-stock prescription-only demo product, a customer account and a second DEMO prescription file.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| X02.01 | Open the prescription product and show Prescription required, then add it to the cart. | Explain why the order needs pharmacist review. | Prescription medicines need pharmacist verification. |
| X02.02 | Proceed to checkout, choose pickup or delivery, and open Details. | Reach the prescription-upload section. | Attach your prescription as part of checkout. |
| X02.03 | Choose the demo file, add optional notes, and click Upload 1 file or the visible upload action. | Finish the actual upload and capture its success. | Submit the prescription for this order. |
| X02.04 | Continue to payment and choose Cash for the order-placement take. | Submit the order while retaining the review requirement. | The pharmacy will review the prescription before dispensing. |
| X02.05 | Open Track order and hold on Under review and the attached document. | Capture the correct pending-review outcome. | Your prescription order is awaiting review. |

**Recorder note:** A prescription order initially goes Under review. Online payment remains blocked until the pharmacy advances it to Awaiting payment. Return for payment after A04 and A02, rather than implying immediate Rx payment succeeds.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## X03 Prescription outcomes and refills

**Role:** Customer  
**Navigation:** /prescriptions -> My prescriptions  
**Purpose:** Show how the customer reads decisions and requests an eligible refill.  
**Before recording:** Prepare approved, clarification and rejected examples. For refill, use an approved, unexpired prescription with remaining refills.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| X03.01 | Open My prescriptions after the pharmacist review. | Show the updated status, review notes and reviewer information. | See the pharmacist decision and notes. |
| X03.02 | Click View and show the private document viewer; use Download if relevant. | Demonstrate access to the customer's own document. | View or download your prescription privately. |
| X03.03 | Show a Clarification requested example and its message. | Explain the extra information needed from the customer. | Read what the pharmacist needs you to clarify. |
| X03.04 | Show an Approved example with remaining refills; click Request refill when that action is available. | Submit the eligible refill for re-review. | Request an available refill for pharmacist review. |
| X03.05 | If the prescription is linked to an order, use View / Pay Order. | Continue through the related order rather than treating approval as payment. | Continue to the linked order when it is ready. |

**Recorder note:** Do not promise a direct replacement-upload response inside the clarification card. The current customer UI supports new uploads and contact with the pharmacy. Refill eligibility and status are rechecked by the server.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## S01 Browse services and book an appointment

**Role:** Customer  
**Navigation:** /services  
**Purpose:** Show service discovery and a pending booking request.  
**Before recording:** Prepare an active service with an image, price, duration and enabled future availability. Sign in as the demo customer.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| S01.01 | Click Care services or mobile Services; search or filter the service catalogue. | Find the relevant care service. | Explore the pharmacy care services. |
| S01.02 | Click Details on a service, then Book appointment. | Show the description and booking entry point. | Review the service before choosing an appointment. |
| S01.03 | Choose Select appointment date and an available time slot. | Show bookable availability for that day. | Choose an available date and time. |
| S01.04 | Optionally add health-context notes using fictional demo text. | Provide information for the appointment request. | Add a note for the pharmacy team if needed. |
| S01.05 | Click Confirm appointment and capture its reference and current status. | Record a saved booking request without claiming staff confirmation. | Your appointment request has been submitted. |

**Recorder note:** A selected slot is not a confirmed visit until the actual status says so. If no slots are available, choose another configured day instead of filming an empty booking as success.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## S02 Choose appointment payment

**Role:** Customer  
**Navigation:** /services -> My Bookings -> booking payment  
**Purpose:** Show the separate appointment-payment choices.  
**Before recording:** Use an unpaid booking for a chargeable service with a nonzero price. Online branches require working provider configuration.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| S02.01 | Open the booking payment prompt or use Pay Now via M-Pesa from appointment details. | Open the appointment-payment dialog. | Choose how to pay for your appointment. |
| S02.02 | Review the service name, booking reference and amount. | Connect the payment to the correct booking. | Check the appointment and amount before paying. |
| S02.03 | For the counter-payment take, click Pay at pharmacy counter during visit. | Save the payment preference without marking it paid. | You can choose to pay at the pharmacy counter. |
| S02.04 | For a separate M-Pesa take, enter the controlled number and click Pay with M-Pesa. | Show provider initiation and the verified result when received. | Approve the M-Pesa prompt on your phone. |
| S02.05 | For the card branch, click Pay with Card and capture the provider handoff. | Demonstrate the alternate hosted payment route. | Use the secure provider checkout for card payment. |

**Recorder note:** A counter-payment preference is not a payment receipt. The current booking admin screen does not provide a clear cash-receipt action; do not invent one for the recording.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## S03 Track an appointment and review a visit

**Role:** Customer  
**Navigation:** /services?tab=bookings  
**Purpose:** Show the customer appointment workspace after booking.  
**Before recording:** Keep one active booking and a separate completed visit for the review scene.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| S03.01 | Open My account -> Appointments or Services -> My Bookings. | Display the customer booking list. | Keep track of your appointments. |
| S03.02 | Click Trace status & details on the booking card. | Show time, reference, progress and payment information. | Check the latest appointment details. |
| S03.03 | Click Add to Calendar. | Download the calendar entry. | Add the appointment to your calendar. |
| S03.04 | Show the WhatsApp or Call Clinic contact action for a change of plans. | Explain how the customer requests rescheduling. | Contact the pharmacy if you need to change the visit. |
| S03.05 | Open the completed booking, choose Review Experience, add stars and feedback, then Submit Review. | Record post-visit feedback. | Tell us about your completed visit. |

**Recorder note:** Customers currently request changes through contact actions; there is no direct customer reschedule/cancel booking button. Staff actions are covered in A12.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## H01 Find products with the assistant

**Role:** Guest or Customer  
**Navigation:** Any customer screen -> Open Sphere Pharmacy AI assistant  
**Purpose:** Demonstrate conversational navigation and product discovery.  
**Before recording:** Use a configured assistant and a known active product. Keep the prompt practical rather than asking for a diagnosis.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| H01.01 | Click Open Sphere Pharmacy AI assistant. | Open the chat workspace. | Ask for help finding your way around Sphere. |
| H01.02 | Type Find a product followed by the demo product name, then press Enter or Send. | Show a catalogue-based assistant response. | Find products using a simple conversation. |
| H01.03 | If a product card is returned, click its product link or Add action. | Open the listing or add one available pack after its current price is checked. | Review a product or add it to your bag. |
| H01.04 | Ask where to find prescriptions or appointments and use the returned navigation action. | Demonstrate a shortcut into the relevant screen. | Jump to the part of the platform you need. |
| H01.05 | For a medication-advice question, show any pharmacy handoff the assistant actually returns. | Keep clinical questions with the pharmacy team. | Ask the pharmacist for personal medicine advice. |

**Recorder note:** Assistant responses depend on the prompt and available data. Rehearse once, and use the action label actually returned. Do not promise treatment recommendations or a particular generated answer.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## H02 Book through the assistant

**Role:** Customer  
**Navigation:** Assistant -> booking action  
**Purpose:** Show an explicit booking confirmation inside the assistant workspace.  
**Before recording:** Sign in, prepare a configured service and future slot, and rehearse a prompt that returns its booking action.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| H02.01 | Ask the assistant to help book the prepared service. | Obtain the relevant service or booking action. | Ask for help booking a care service. |
| H02.02 | Click the booking action and complete sign-in if the private panel requests it. | Open the account-scoped booking controls. | Booking details stay inside your account. |
| H02.03 | Choose the appointment date and Available time. | Show live slot availability. | Choose a time that is available. |
| H02.04 | Review the service, date, time and Nairobi-time summary. | Make the proposed appointment explicit before submission. | Review the appointment before sending the request. |
| H02.05 | Click Confirm booking request, then open Appointments. | Capture the saved booking in the normal customer workspace. | Your booking request is ready for pharmacy follow-up. |

**Recorder note:** Use a separate slot from S01 to avoid a collision. If the response is uncertain, use Check my appointments first before sending another request.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## H03 Pay through the assistant

**Role:** Customer  
**Navigation:** Assistant -> payment action  
**Purpose:** Show the assistant payment review and status check.  
**Before recording:** Use a signed-in demo account with an eligible unpaid order or payable appointment and configured M-Pesa.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| H03.01 | Ask the assistant for help paying an order or appointment, then open its payment action. | Open the private payment workspace. | Get help with an outstanding payment. |
| H03.02 | Under Pay for, choose the correct order or appointment. | Load its reference and amount. | Choose exactly which item you want to pay for. |
| H03.03 | Enter the controlled M-Pesa phone number and read the payment review. | Confirm payee, amount, reference and destination number. | Check the amount and phone number before sending. |
| H03.04 | Click Send M-Pesa prompt. | Initiate a provider request after an explicit click. | Approve the M-Pesa prompt on your phone. |
| H03.05 | Use Check payment status, or View my orders / other payment options. | Verify the server result or return to the standard payment screen. | Check the result before starting another payment. |

**Recorder note:** A chat request alone does not authorise or complete payment. Never caption a sent prompt as a successful charge.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## A01 Staff sign in and daily overview

**Role:** Admin  
**Navigation:** /admin or /auth?mode=staff&next=admin  
**Purpose:** Introduce internal access, admin navigation and the operational overview.  
**Before recording:** Use a dedicated admin account with demo orders and activity. Keep customer and staff browser sessions separate.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| A01.01 | From a non-home footer choose Staff dashboard, then Sign in as staff; alternatively open /admin. | Reach the staff gate and sign-in form. | Staff use a separate sign-in to manage the pharmacy. |
| A01.02 | Choose Staff, enter the demo Staff email and Password off-camera, then Sign in to dashboard. | Start the admin session. | Sign in to the staff dashboard. |
| A01.03 | Hold on Overview and scroll through order, revenue, queue and inventory cards. | Show the current operational snapshot. | See the pharmacy workload at a glance. |
| A01.04 | Click a relevant overview card, such as Pending prescriptions or Active orders. | Open the matching work queue or section. | Move from the overview straight to the work that needs attention. |
| A01.05 | Show the admin sidebar; on mobile open Open admin menu. | Explain where Orders, Prescriptions, Medicine requests and other sections live. | Use the admin menu to move between work areas. |

**Recorder note:** The active homepage footer has My account, rather than Staff dashboard. The non-home footer or /admin is the reliable staff entry point. Role-specific menus are covered in T01 and T02.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## A02 Process an order to pickup

**Role:** Admin or permitted pharmacy staff  
**Navigation:** /admin?section=orders  
**Purpose:** Show order triage, payment evidence and the pickup workflow.  
**Before recording:** Use O01 for a cash example; have a separate already-paid order if needed. Never mark cash received before the demonstration transaction is arranged.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| A02.01 | Open Orders and show Queue, All orders, search, status, type and date filters. | Locate the recording order by reference. | Find the order that needs processing. |
| A02.02 | Click its row or card and inspect customer, items, notes, payments and status history. | Open the order detail drawer. | Review the order details before taking action. |
| A02.03 | For an OTC Received order, click Confirm availability, confirm the action, then Request payment when offered. | Move the order through the allowed preparation steps. | Confirm availability before requesting payment. |
| A02.04 | After payment is actually received, use Mark paid (cash received) for cash, or show the provider-confirmed payment record. | Establish genuine payment evidence for the next stage. | Record payment only after it is received. |
| A02.05 | Click Start preparing, then Ready for pickup, confirming each dialog. | Progress the paid pickup order through fulfillment. | Prepare the order and mark it ready for collection. |
| A02.06 | At collection, use Complete pickup and capture the final history; switch to the customer order to show the same result. | Finish the journey across both roles. | The collected order is now complete. |

**Recorder note:** Some statuses advance automatically after prescription review or provider payment. Use the action available for the current state. A generic Mark as paid transition alone is not a substitute for a real payment record.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## A03 Assign and dispatch a delivery

**Role:** Admin or permitted dispatch staff  
**Navigation:** /admin?section=dispatch and /admin?section=orders  
**Purpose:** Connect a paid delivery order to an active rider.  
**Before recording:** Prepare a paid delivery order and an active Rider account with contact details. Keep its reference for R01.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| A03.01 | Open Dispatch and review Unassigned, Assigned / active and Rider workload. | Show the delivery work queue. | See which deliveries still need a rider. |
| A03.02 | Find the prepared order, choose a rider from its assignment dropdown, then click Assign. | Attach the delivery to a specific active rider. | Assign the delivery to the right rider. |
| A03.03 | Show the rider name and the contact actions. | Verify the assignment is saved. | The assigned rider is linked to this delivery. |
| A03.04 | If needed, use Orders to Start preparing, then Dispatch for delivery from the allowed state. | Advance the paid delivery into Out for delivery. | Mark the order as out for delivery when it leaves. |
| A03.05 | Switch to the rider session and locate the same reference. | Show the order is visible to the assigned rider. | The rider can now follow the assigned delivery. |

**Recorder note:** Rider Start delivery buttons are shown for more states than the server currently accepts. The reliable core take is staff Dispatch for delivery followed by the rider completion flow in R01. Rehearse any earlier rider-start branch before including it.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## A04 Review and approve a prescription

**Role:** Pharmacist or Admin  
**Navigation:** /admin?section=prescriptions  
**Purpose:** Show the pharmacist document review and an approved outcome.  
**Before recording:** Use a DEMO prescription from X01 or X02 and a separate pharmacist session.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| A04.01 | Open Prescriptions and choose the pending review queue. | Locate the submitted demo document. | New prescriptions enter the pharmacist review queue. |
| A04.02 | Open the prescription and choose View document or Document. | Display the actual submitted image or PDF. | Review the prescription document before deciding. |
| A04.03 | Click Proceed to review if shown, then select Approve. | Open the pharmacist decision controls. | Record the pharmacist decision. |
| A04.04 | Set Refills allowed and Validity period, and add optional review notes. | Save the permitted refill and validity information. | Add the review conditions and notes. |
| A04.05 | Click Approve prescription and hold on the approved status and reviewer details. | Capture the decision as a completed staff action. | The prescription has been approved. |
| A04.06 | Show the customer prescription result and any linked order state. | Connect staff review to the customer journey. | The customer can see the review outcome in their account. |

**Recorder note:** For an order with multiple prescriptions, every attachment must be reviewed before payment can be accepted. Use only fictional patient and prescriber details in the video.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## A05 Clarify partially approve or reject a prescription

**Role:** Pharmacist or Admin  
**Navigation:** /admin?section=prescriptions  
**Purpose:** Cover the alternative pharmacist decisions with clear reasons.  
**Before recording:** Prepare three separate pending DEMO documents. Do not reuse the already-approved prescription.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| A05.01 | Open the clarification example, view its document, then choose Clarify. | Show the review branch for missing information. | Request clarification when more information is needed. |
| A05.02 | Enter Message to customer and click Send clarification request. | Save the reason and the customer-facing review outcome. | Tell the customer what needs to be clarified. |
| A05.03 | On a second document, choose Partial approval and fill Unavailable items, refills and validity as applicable. | Explain the limit of the approval. | Record which requested items are unavailable. |
| A05.04 | Click Save partial approval and capture the status. | Save the partial review result. | The prescription has been partially approved. |
| A05.05 | On a third document, choose Reject, enter Reason for rejection, and click Reject prescription. | Demonstrate an explained rejection. | Save a clear reason when a prescription cannot be approved. |

**Recorder note:** Use separate takes with separate documents for each outcome. Clinical decisions must be framed as demonstration examples, not as medical advice to viewers.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## A06 Manage medicine requests

**Role:** Admin Pharmacist or Staff  
**Navigation:** /admin?section=medicine-requests  
**Purpose:** Complete the customer-to-pharmacy missing-medicine journey.  
**Before recording:** Keep P04 and P05 requests available, including one with a photo.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| A06.01 | Open Medicine requests from the admin menu. | Show the callback-request queue. | Customer medicine requests arrive in one place. |
| A06.02 | Search by medicine name or stored phone number; choose a status filter. | Find the enquiry to follow up. | Find a request by medicine or phone number. |
| A06.03 | Open View photo on the request that has an attachment. | Show the private medicine reference image. | View the optional photo shared with the pharmacy. |
| A06.04 | Show the phone link, add Staff notes, and choose Contacted under Status. | Record the follow-up outcome; do not place a real call during the take. | Contact the customer and keep an internal follow-up note. |
| A06.05 | Click Save changes, then demonstrate Fulfilled or Unavailable on the appropriate separate request. | Capture the persisted status and notes. | Keep each request status up to date. |

**Recorder note:** Statuses are New, Contacted, Fulfilled and Unavailable. A status change does not automatically call or message the customer, or create an order. Phone search uses the stored international format, such as +254... .

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## A07 Update existing products and stock

**Role:** Admin Pharmacist or Staff  
**Navigation:** /admin?section=catalogue  
**Purpose:** Show everyday inventory and listing maintenance.  
**Before recording:** Prepare demo products for stock, price and visibility edits. Keep the C07 product ID for the restock take.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| A07.01 | Open Catalogue, search by name, SKU or brand, and use category or stock filters. | Locate the demo listing. | Find the product you need to update. |
| A07.02 | Use the stock plus or minus control and show the saved quantity. | Adjust the inventory count. | Keep stock quantities current. |
| A07.03 | Use the inline price control or Edit to change the price and save. | Update the customer-facing price. | Update a product price when needed. |
| A07.04 | Show the prescription requirement and Live visibility switches on a disposable listing. | Demonstrate product controls that affect the shop. | Control prescription requirements and storefront visibility. |
| A07.05 | Restock the C07 product and reopen it in the customer session. | Show the catalogue reflecting current stock. | Updated stock is reflected in the shop. |

**Recorder note:** Use Edit if a direct price change needs an explicit save. The UI includes a prescription toggle, but this is a pharmacy classification decision; restore the intended value after a demonstration.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## A08 Create a product and choose its images

**Role:** Admin  
**Navigation:** /admin?section=catalogue  
**Purpose:** Show the complete listing form and reusable image library.  
**Before recording:** Prepare a demo product name, unique SKU, category, price and a non-patient pack image.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| A08.01 | Click Add product. | Open the new-product editor. | Add a new product to the catalogue. |
| A08.02 | Fill Name, SKU, Category, Brand, Pack size, Price and Stock quantity. | Set the basic listing and inventory information. | Enter the product and stock details. |
| A08.03 | Click Browse gallery and choose a photo; show search and Show more photos if available. | Reuse an existing image instead of duplicating uploads. | Choose an image from the shared product gallery. |
| A08.04 | In a separate image take, use the upload control or custom image path field. | Demonstrate the alternative image sources. | Upload a new product photo when needed. |
| A08.05 | Add Description, Usage info, Warnings and the correct Prescription-only setting; click Add product. | Save the complete product listing. | Save the details customers will see. |
| A08.06 | Open the new listing in the customer catalogue. | Confirm the published appearance. | The new product is available in the shop. |

**Recorder note:** Add product and delete controls are admin-only in the current catalogue UI. Use a separate disposable listing to demonstrate Delete product and its confirmation.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## A09 Import products from CSV

**Role:** Permitted catalogue staff  
**Navigation:** /admin?section=catalogue -> CSV import  
**Purpose:** Show the bulk-product import with both new and existing SKUs.  
**Before recording:** Prepare a small CSV using Download template: one new demo SKU and one disposable existing SKU. Keep an invalid row for a separate error take.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| A09.01 | Click CSV import and then Download template. | Show the expected import format. | Start with the product import template. |
| A09.02 | Show the prepared file briefly, then use upload a .csv file or Paste CSV. | Load the product rows into the importer. | Import several product changes at once. |
| A09.03 | Review the expected columns and the selected file or pasted content. | Confirm what will be submitted. | Check the import data before continuing. |
| A09.04 | Click Import CSV and hold on the created and updated counts. | Capture the actual import result. | New SKUs are created and matching SKUs are updated. |
| A09.05 | Search for the imported SKU in Catalogue. | Verify one imported product in the interface. | Review the imported products in the catalogue. |

**Recorder note:** For an error take, show the reported row errors and correct the file. Do not describe a partial import as if every row succeeded. Importing an existing SKU changes that product.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## A10 Publish a service and set booking hours

**Role:** Admin Pharmacist or Staff  
**Navigation:** /admin?section=services  
**Purpose:** Show service content, images and the availability that drives bookings.  
**Before recording:** Prepare a demo service, price, duration, image and a future recording day.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| A10.01 | Open Services and click New service. | Open the service editor. | Create a care service customers can book. |
| A10.02 | Enter Service name, Category, Duration, Price, Display price and descriptions. | Configure the service listing. | Set the service details, duration and price. |
| A10.03 | Upload a Hero image and optional Gallery images. | Show how the service is presented visually. | Add useful photos of the service environment. |
| A10.04 | Set Show on storefront and Feature service as intended, then click Save service. | Publish the listing with its visibility settings. | Choose whether the service appears in the catalogue. |
| A10.05 | On the service card click Hours, enable a day and set its start and end times, then Save hours. | Make valid booking hours available. | Set the times when customers can request appointments. |
| A10.06 | Open the customer service and check a date within those hours. | Connect admin configuration to customer availability. | Customers choose from the available appointment slots. |

**Recorder note:** Feature service saves a marketing-priority flag, but the current homepage has static service content. Do not promise automatic homepage replacement without checking the deployed page. Archive is available on service cards; demonstrate it only on a disposable service.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## A11 Run the appointment workflow

**Role:** Admin Pharmacist or Staff  
**Navigation:** /admin?section=service-bookings  
**Purpose:** Show daily appointments from confirmation to completed care.  
**Before recording:** Use the booking from S01. Note its date in Nairobi time and have an active staff member available for assignment.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| A11.01 | Open Bookings and set the date to the demo appointment day. | Show Total, Pending and Confirmed counts and the booking card. | View the care schedule for the selected day. |
| A11.02 | Choose an active staff member from Assign staff. | Assign responsibility for the appointment. | Assign the appointment to a team member. |
| A11.03 | On a pending booking click Confirm and capture the new status. | Record pharmacy confirmation. | Confirm the appointment with the customer. |
| A11.04 | Click Mark arrived when the demonstration visit begins, then Start. | Move the visit through Arrived and In progress. | Record arrival and start the care session. |
| A11.05 | Click Complete and switch to the customer appointment view. | Finish the visit and expose the completed-visit review action. | The completed visit is recorded in the customer account. |

**Recorder note:** These actions update the care workflow, not the payment record. Do not caption Complete as proof that the appointment has been paid.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## A12 Reschedule and cancel appointments

**Role:** Admin Pharmacist or Staff  
**Navigation:** /admin?section=service-bookings  
**Purpose:** Show staff-managed changes to the care schedule.  
**Before recording:** Prepare one pending booking for rescheduling and a different pending or confirmed booking for cancellation. Use a free future slot inside enabled hours.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| A12.01 | Locate the reschedule example by its booking date and reference. | Identify the correct appointment. | Find the appointment that needs a new time. |
| A12.02 | Click Reschedule and enter Start and End with the original service duration. | Prepare a valid replacement timeslot. | Choose a new time within the service availability. |
| A12.03 | Click Save new time and capture Rescheduled. | Save the changed appointment and its new time. | The appointment time has been updated. |
| A12.04 | Show the new details in the customer appointment view. | Confirm the customer sees the change. | The customer can see the updated appointment. |
| A12.05 | On the separate cancellation example, click Cancel and hold on Cancelled. | Record a staff cancellation without affecting the main completed-visit take. | Cancel an appointment when it cannot go ahead. |

**Recorder note:** Rehearse rescheduling before filming: the current staff UI marks a booking Rescheduled but does not expose a Confirm button for that status. Do not promise the full rescheduled-to-completed sequence from these controls. Server checks also enforce service hours, duration and conflicts.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## A13 Moderate product reviews

**Role:** Admin or Pharmacist  
**Navigation:** /admin?section=reviews  
**Purpose:** Show how staff publish or hide customer product feedback.  
**Before recording:** Use the C09 demo product review and keep a customer window on that product.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| A13.01 | Open Reviews and show All, Published and Hidden filters. | Display the moderation queue. | Review customer feedback from one queue. |
| A13.02 | Locate the demo rating, author and comment. | Inspect the review before acting. | Read the review in its product context. |
| A13.03 | Click the hide action and show the Hidden badge. | Remove the review from public display. | Hide a review when moderation requires it. |
| A13.04 | Refresh the customer product reviews. | Show the public result of the moderation action. | The storefront reflects the moderation decision. |
| A13.05 | Return to the hidden review and use Restore. | Publish the review again. | Restore a review when it should be visible again. |

**Recorder note:** This section moderates product reviews. Do not describe it as a separate moderation screen for service-experience reviews.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## A14 Create and use a promotion

**Role:** Admin or Staff  
**Navigation:** /admin?section=promotions -> /checkout  
**Purpose:** Connect a staff-created discount code to the customer total.  
**Before recording:** Use a unique recording code, sensible discount and an active date range. Prepare a separate customer cart.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| A14.01 | Open Promotions and click New promotion. | Open the campaign editor. | Create a promotion for customers. |
| A14.02 | Enter Title, Description, Promo code, Discount %, Badge and dates as needed. | Define the offer and its validity. | Set the offer details and dates. |
| A14.03 | Enable Live on storefront and click Create promotion. | Save the promotion as active. | Make the promotion available for eligible use. |
| A14.04 | In the customer checkout enter the code and click Apply. | Validate the code and show the discount line. | Apply the promotion and review the savings. |
| A14.05 | Back in Promotions, show editing or pausing the disposable offer; use a separate take for deletion. | Demonstrate ongoing campaign management. | Pause or update a promotion when the offer changes. |

**Recorder note:** The current homepage does not automatically render all legacy promotional banners. Show the promotion list and successful checkout code, rather than promising a homepage banner that is not visible.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## A15 Manage staff accounts and roles

**Role:** Admin  
**Navigation:** /admin?section=staff  
**Purpose:** Show controlled access for pharmacists, counter staff and riders.  
**Before recording:** Use disposable demo staff accounts. Keep generated passwords and actual credentials out of the recording.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| A15.01 | Open Staff and show the team list and What each role can access. | Explain role-based internal access. | Give team members access for their work. |
| A15.02 | Click Add staff and enter Full name, Email, Phone, Job title and Role. | Create a role-specific staff identity. | Add a staff member with the appropriate role. |
| A15.03 | Set or generate a strong password off-camera, then click Add staff member. | Save the staff account without publishing credentials. | Share staff access details privately. |
| A15.04 | Open the edit action on the demo member and update the role or title. | Demonstrate maintaining staff details. | Keep staff responsibilities and details current. |
| A15.05 | Use Active on a disposable account to demonstrate deactivation; show removal confirmation only if needed. | Explain stopping access without using the current admin account. | Deactivate access when a team member no longer needs it. |

**Recorder note:** Never deactivate or remove the recording admin. Capture password resets only with a disposable account and cut credential entry. Use at least 10 characters with letters and numbers regardless of older helper text.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## A16 Reports service analytics and audit activity

**Role:** Admin  
**Navigation:** /admin?section=reports and /admin?section=service-analytics  
**Purpose:** Show owner-level reporting and the evidence behind operational changes.  
**Before recording:** Prepare completed demo orders, a completed service booking and recent staff activity.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| A16.01 | Open Reports and show revenue, top products and the order funnel. | Summarise order performance. | Review sales and the order pipeline. |
| A16.02 | Click Top products CSV. | Download the visible report export. | Export top-product results for further review. |
| A16.03 | Open Service analytics. | Show the last-30-days service totals and By service table. | Review care-service activity and revenue. |
| A16.04 | Return to Overview -> Recent activity. | Show recorded staff actions with their timestamps. | See recent operational activity. |
| A16.05 | Open Compliance -> Compliance audit trail for the compliance-specific history. | Show where licence changes are tracked. | Review the history of compliance updates. |

**Recorder note:** There is an audit API but no separate general Audit section in the current admin navigation. Film visible Recent activity and Compliance audit trail. Do not imply that an unexposed audit page exists.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## A17 Compliance information

**Role:** Admin with Pharmacist view only  
**Navigation:** /admin?section=compliance  
**Purpose:** Show where the pharmacy records licence and superintendent details.  
**Before recording:** Use a rehearsal environment with authorised demo data. Keep real licence records unchanged during recording.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| A17.01 | Open Compliance and show the licence, expiry and superintendent summary. | Display the compliance record. | Keep the pharmacy compliance record accessible to authorised staff. |
| A17.02 | As Admin, show Premise licence number, Licence expiry, Superintendent name and PPB registration fields. | Demonstrate the editable compliance information. | Record the licence and superintendent details accurately. |
| A17.03 | In rehearsal only, edit the authorised demo record and click Save compliance details. | Capture a saved compliance change. | Save verified compliance information. |
| A17.04 | Scroll to Compliance audit trail. | Show the actor and timestamp of the update. | Compliance edits leave an audit trail. |
| A17.05 | Switch to Pharmacist and show the view-only notice. | Demonstrate the editing restriction. | Pharmacists can view this record; admins maintain it. |

**Recorder note:** Do not enter invented live licence details or present a missing licence as verified. If no current licence is supplied, film the existing no-current-licence state and explain it truthfully.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## A18 Pharmacy settings and delivery pricing

**Role:** Admin  
**Navigation:** /admin?section=settings  
**Purpose:** Show the configuration available to the pharmacy owner.  
**Before recording:** Use rehearsal settings and record the original values before editing. Do not change live contact details or delivery prices for the video.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| A18.01 | Open Settings -> Pharmacy profile. | Show name, contact, address, hours and map fields. | Maintain the pharmacy profile from the admin dashboard. |
| A18.02 | Open Delivery settings and show flat-fee and zone-based choices. | Explain the available fee setup. | Set delivery charges for the areas you serve. |
| A18.03 | Show Free delivery over, named zones and the optional night-delivery setting. | Demonstrate configurable delivery rules. | Configure free-delivery thresholds and zone fees. |
| A18.04 | Show Delivery origin & pricing method and the distance-band controls where used. | Explain the distance-based configuration branch. | Configure delivery pricing from the pharmacy location. |
| A18.05 | Click Save pharmacy profile or Save delivery settings in rehearsal, then verify the relevant customer screen. | Check the practical outcome rather than only the form values. | Check the delivery quote from the customer checkout. |

**Recorder note:** Some public branding and contact links still read static constants. Verify the exact customer screen before claiming every public label updates instantly. Integration status labels alone do not prove an email or push has been delivered. Demo data controls are not part of the main recording.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## R01 Complete an assigned delivery

**Role:** Rider  
**Navigation:** /admin -> Dispatch  
**Purpose:** Show the rider-specific view and delivery completion.  
**Before recording:** Use an active Rider account and the assigned, paid, Out for delivery order from A03.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| R01.01 | Sign in through the Staff tab using the demo rider account. | Land on the rider dispatch workspace. | Riders see their assigned deliveries. |
| R01.02 | Open the assigned order and review address, directions and customer contact. | Show the information needed for the handoff. | Review the delivery details before setting off. |
| R01.03 | Show Call or WhatsApp as customer-contact options without contacting a real person. | Demonstrate how a rider can clarify the handoff. | Contact the customer if you need directions. |
| R01.04 | For the prepared Out for delivery order, click Mark delivered. | Record completion of the assigned delivery. | Mark the delivery complete after the handoff. |
| R01.05 | Switch to the customer order and the admin order history. | Show the same completed-delivery result across roles. | The delivery outcome is visible to the customer and pharmacy. |

**Recorder note:** An optional Cash Received action appears for unpaid assigned deliveries and has strict server checks. Use a separately rehearsed cash example. Do not promise an unpaid dispatch path works just because a button is visible.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## T01 Pharmacist workspace and access boundaries

**Role:** Pharmacist  
**Navigation:** /admin  
**Purpose:** Show the real pharmacist menu and its core responsibilities.  
**Before recording:** Use a separate pharmacist browser profile, with a demo prescription and medicine request ready.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| T01.01 | Sign in as Pharmacist and open the admin menu. | Show the sections permitted to this role. | Pharmacists have a workspace for care and review. |
| T01.02 | Open Prescriptions and show the pending queue. | Connect the role to its main review duty. | Review prescriptions before dispensing. |
| T01.03 | Open Medicine requests, then Bookings. | Show follow-up enquiries and appointment work. | Follow up on medicine enquiries and care visits. |
| T01.04 | Open Compliance and show its view-only editing boundary. | Demonstrate the permitted compliance access. | View compliance details without changing admin records. |
| T01.05 | Show that Staff, Reports, Settings and owner Overview are not in the pharmacist menu. | Explain that owner controls remain separate. | Staff access is limited to the sections their role permits. |

**Recorder note:** Current pharmacist menu also includes Orders, Dispatch, Services, Catalogue and Reviews. Do not use an old role summary that says pharmacists only see prescriptions.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## T02 Counter staff workspace and access boundaries

**Role:** Staff  
**Navigation:** /admin  
**Purpose:** Show the counter-staff version of the dashboard.  
**Before recording:** Use a separate Staff account with an OTC order, request and booking available.

| Step | Click or navigation | Purpose and expected screen | On-screen caption |
| --- | --- | --- | --- |
| T02.01 | Sign in as Staff and open the admin menu. | Display the role-specific navigation. | Counter staff see the tools needed for daily operations. |
| T02.02 | Open Orders and show the prepared OTC order. | Demonstrate daily order processing. | Manage the order queue from the counter. |
| T02.03 | Open Medicine requests and update a demo callback note. | Show customer-enquiry follow-up within staff access. | Keep medicine enquiries moving. |
| T02.04 | Open Dispatch, Bookings, Services, Catalogue and Promotions as short overview cuts. | Show the operational sections available to this role. | Support deliveries, appointments and catalogue updates. |
| T02.05 | Show that Prescriptions review, Reviews moderation, Staff management, Reports, Compliance and Settings are absent. | Make the access boundary visible. | Restricted owner and pharmacist controls stay separate. |

**Recorder note:** The current Staff role can edit existing catalogue items but does not see Add product or Delete product. Use Admin for new-product and removal demonstrations.

**Capture check:** Hold the final result for 3 seconds. Record the reference if this scene hands work to another role. Mark the take complete only when the expected screen is visible.

## Conditional and unavailable journeys

| Topic | Recording instruction |
| --- | --- |
| Guest checkout | The normal cart action redirects to sign-in, even for OTC items. Film C03 rather than promising a guest purchase. |
| Payment demonstrations | The current routes call M-Pesa and IntaSend providers. There is no website fake-PIN or card-number simulator. Rx orders must reach Awaiting payment first. |
| Cash on delivery and rider start | Unpaid fulfillment and the early rider Start delivery states have server restrictions. Use the paid, staff-dispatched delivery for the main film; rehearse any COD extension separately. |
| Rescheduled bookings | The staff screen can save Rescheduled but does not offer Confirm for that status. Film the saved time change without promising the remaining lifecycle from that screen. |
| Customer appointment changes | Use the contact actions and the staff reschedule/cancel flow. The customer screen does not provide direct self-service change buttons. |
| Standalone prescription reuse | The current checkout has an upload area, not a selector for existing standalone prescriptions. Show standalone and order-attached uploads as separate journeys. |
| Refunds | No refund action is exposed in the current admin order screen. Do not film or caption an automatic refund. Paid cancellations require the separate provider-refund process. |
| Saved items and account features | The product heart works, but the active header does not show the old wishlist drawer. Download my data is Coming soon. Password reset is not a public forgot-password journey. |
| Notifications and promotional content | The account exposes Email and device push controls. Verify actual delivered messages; status badges are not delivery evidence. Legacy homepage banners and service-feature flags are not automatically rendered by the current static homepage. |
| Public settings and regulatory claims | Some customer text reads static constants. Verify the visible result before claiming all public content changed. Use supplied verified licence details only. |

## Final editing check

- Match each caption to the result actually visible in that shot.
- Keep waiting, pending, confirmed, paid and completed states distinct.
- Blur credentials, real patient information, controlled-phone details and any provider authentication screens.
- Cut failed rehearsals and duplicate submissions from the main journey; label intentional error demonstrations separately.
- Keep role switches obvious with Customer, Admin, Pharmacist, Staff and Rider chapter cards.
- Rehearse conditional provider and workflow branches against the exact environment used for recording.

## Maintenance references

Checked against these current repository areas; no application behavior was changed to produce this script:

- src/app/page.tsx; src/components/home/sphere-landing.tsx; src/components/layout/sphere-header.tsx; customer-hub-nav.tsx; mobile-nav.tsx; notification-center.tsx
- src/components/views/auth-view.tsx; account-view.tsx; catalog-view.tsx; product-view.tsx; cart-view.tsx; checkout-view.tsx; orders-view.tsx; order-detail-view.tsx; prescriptions-view.tsx; services-view.tsx
- src/components/catalog/medicine-request.tsx; src/components/views/admin/admin-view.tsx; src/components/views/admin/sections/*.tsx
- src/components/assistant/assistant-widget.tsx; assistant-actions.tsx; src/lib/constants.ts; src/lib/security/order-workflow.ts
- src/app/api/orders/route.ts; orders/[id]/cash-confirm/route.ts; payments/mpesa/initiate/route.ts; payments/intasend/initiate/route.ts; admin/service-bookings/route.ts; admin/medicine-requests/route.ts
