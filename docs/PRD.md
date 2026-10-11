# YogaPriyanshi — Product Requirements Document (PRD)

**Version:** 2026-10-10 · **Owner:** Priyanshi (studio owner) · This is the one and only PRD for this website.

> **Part of the 8 project docs:** PRD · [DESIGN_SYSTEM](DESIGN_SYSTEM.md) · [ARCHITECTURE](ARCHITECTURE.md) · [DATABASE](DATABASE.md) · [SECURITY](SECURITY.md) · [CODE_STYLE](CODE_STYLE.md) · [TESTING](TESTING.md) · [AGENTS](../AGENTS.md)

## 0. Status (2026-10-10): what's built vs. this spec

| Area | Status |
|---|---|
| Public site: hero, classes, pricing, schedule, about, testimonials, contact | ✅ Built (single page, sections, not separate URLs). The redesign is planned in `design/DESIGN-PHASE.md`. |
| Free-class booking, rules, cancellation | ✅ Built and tested. The live site and the tests now run the same API (`backend/`). |
| Persistent database | ✅ Wired to Turso `yogapriyanshi-live` (production only; previews have none). Goes live once the env vars are set and `npm run db:migrate:live` has run. See [DATABASE.md](DATABASE.md). |
| Email alerts | ✅ Wired to Resend: student confirmations, plus booking, cancellation and contact alerts. Alerts go to the `notify_email` setting (**nbsingh2050@gmail.com during testing**, then Priyanshi's email at launch, changed in the admin settings). Students get mail from `EMAIL_FROM`, with replies going to the `studio_email` setting. |
| Admin dashboard | ✅ On the shared API with real numbers (revenue counts paid orders only, so it's 0 until payments exist). Sign-in needs `ADMIN_PASSWORD_HASH` to be set. |
| Payments | ⚠️ No online payment yet. Paid classes and packs are **reserved and paid at the studio** (the server accepts only `studio` as the payment method). Paid packs don't yet redeem credits on later bookings. Stripe Checkout comes later (§7.7). |
| Leftovers to remove | The DesignShowcase modal and the theme switcher. (The Socratic Math Tutor, the email inbox and "Export Code" are removed.) |

**Still to fill in:** the real phone number (a placeholder today).

---

---

## 1. Overview

**YogaPriyanshi** is the website and booking system for a solo yoga instructor based in Dubai, UAE. Prospective students discover Priyanshi's classes, see a real weekly schedule with live availability, and book a class — starting with a **free first class** — without needing an account. Priyanshi gets a private dashboard to see bookings, clients, revenue and messages, and is notified when someone books or writes in.

**One-line pitch:** *A calm, premium, mobile-friendly site where a student can go from "who is this?" to "I'm booked for Monday 7am" in under two minutes.*

## 2. Goals & Non-Goals

### Goals
1. Convert visitors into booked students, with the **free first class** as the main on-ramp.
2. Show **real, live availability** (spots left per class) so nobody books a full class.
3. Enforce Priyanshi's booking rules automatically (capacity, no double-booking, cancellation policy).
4. Give Priyanshi a simple private dashboard and email alerts so she never has to chase information.
5. Look and feel like a boutique wellness brand: quiet, warm, editorial — not a generic template.

### Non-Goals (Phase 1)
- Real online payments (card checkout) — the paid plans are shown, but paid purchase shows a "launching soon" message. Payments are Phase 2.
- Customer accounts / login / passwords for students.
- Multiple instructors, multi-studio, or multi-language support.
- Video hosting / on-demand class library.

## 3. Users

| User | Description | Primary need |
|---|---|---|
| **Prospective student** | Dubai-based (or remote) adult, mobile-first, found Priyanshi via Instagram/ClassPass/word of mouth | Quickly understand the classes, see times, book free class |
| **Returning student** | Has booked before | See schedule, book/cancel a class |
| **Priyanshi (admin)** | Instructor/owner, non-technical | See who booked, earnings, messages; get notified; not manage servers |

## 4. Brand & Design Direction

- **Mood:** calm, grounded, premium, warm, editorial. Lots of whitespace, slow fade-in motion, no loud gradients or stock-template feel.
- **Palette:** near-black "ink" (`#0f0e0b`), warm cream/parchment backgrounds (`#f2ede4`, `#faf8f3`), sand/gold accent (`#c4b48a`), muted warm greys for body text.
- **Typography:** *Playfair Display* (serif, often italic) for headings; *DM Sans* for body/UI. Small uppercase letter-spaced labels (eyebrows) above headings.
- **Imagery:** dark, moody hero (a stylised Buddha/figure treated in sepia/low-opacity), real photos of Priyanshi (skyline, lake, studio, pose), an Instagram-style photo strip.
- **Buttons:** rectangular, small uppercase letter-spaced text, sand-filled primary / outlined secondary.
- **Responsive:** must be excellent on a phone (most traffic). Desktop schedule grid collapses to stacked day cards on mobile. A **sticky "Book" bar** appears after scrolling on every page.
- **Motion:** subtle page-enter fade-up; no distracting animations.

## 5. Content (must be used as given)

**Studio:** BurJuman Residence Block D, Dubai, UAE (confirmed 2026-10-10)
**Email shown on site:** priyanshi@yogapriyanshi.com · **Phone:** placeholder `+971 50 000 0000` (to be replaced)
**Instagram:** @yogapriyanshi · **Also listed on:** ClassPass, FindYoga
**Credibility stats (hero strip):** 7+ years · MA Yoga Science · 200hr YTT · 4 signature styles · "Rated on ClassPass" (5 stars)
**Hero:** title "YogaPriyanshi", tagline **"Connect with your body."**, style list "Hatha · Barre · Wheel · Chakra Flow", CTAs "Begin your journey" (→ Join) and "View classes".
**Timezone:** all times shown in UAE time (GMT+4). **Studio hours:** Mon–Sun 6:30 AM – 8:00 PM. All classes available online and in person.

### Classes (4 signature styles)
| Class | Level | Duration | Description |
|---|---|---|---|
| Hatha Yoga | All levels | 60 min | The classical root of the practice — foundational postures, precise alignment, and the relationship between breath and movement. No experience necessary. |
| Barre Yoga | All levels | 60 min | Strength work woven with deep, intentional stretching. Small controlled movements build heat and tone, then long holds open everything back up. |
| Wheel Yoga | All levels | 75 min | Priyanshi's signature class. The yoga wheel supports the spine through backbends and chest openers that feel impossible without it — then suddenly don't. |
| Chakra Yoga Flow | Beginner friendly | 60 min | A moving meditation through the body's energy centres, pairing breath, sound, and sequence. Grounding, clearing, and deeply restorative. |

### Weekly schedule (recurring, Dubai time)
| Day | Time | Class | Capacity |
|---|---|---|---|
| Monday | 7:00 AM | Barre Yoga | 12 |
| Tuesday | 6:00 PM | Hatha Yoga | 12 |
| Wednesday | 7:00 AM | Barre Yoga | 12 |
| Thursday | 6:00 PM | Wheel Yoga | 10 |
| Friday | — | Rest day | — |
| Saturday | 9:00 AM | Chakra Yoga Flow | 15 |
| Sunday | 10:00 AM | Hatha Yoga | 12 |

### Plans & pricing (currency: AED)
| Plan | Price | Credits | Validity | Notes |
|---|---|---|---|---|
| First class | **Free** | 1 | — | Any style, no card required, **one per person (email) ever** |
| Single class | AED 350 | 1 | No expiry | Drop in once |
| 10-class pack | AED 3,000 | 10 | 3 months | AED 300/class; "Most popular" tag; class recordings (7 days) |
| 20-class pack | AED 5,600 | 20 | 6 months | AED 280/class, save AED 400; "Best value" tag; 1 private session included; priority booking |
| Private 1-to-1 | AED 500 / 60 min | — | — | Mentioned as an add-on |

Extra pricing-page notes: *Packs are shareable (bring a friend on your credits). Free cancellation up to 6 hours before class.*

### Policies (display verbatim on Schedule page "Good to know")
- Cancellations are **free up to 6 hours** before class. **Late cancellations use one class credit.** First class is always free.

### Page copy tone
Warm, short, confident, second-person ("Start with a free class — no card, no commitment."). Avoid hype and exclamation marks.

## 6. Site Map & Page Requirements

### 6.1 Home
Hero (see §5), credibility strip, "Four paths" section introducing the 4 classes, a student-testimonials section (can be toggled on/off), a short "A minute with Priyanshi" intro, an "From the studio" Instagram-style photo strip linking to her Instagram, a closing CTA to book. Footer on every page with nav + Join link.

### 6.2 About
"Hello, I'm Priyanshi" hero; her story ("A path that began…"); philosophy/approach; CTA to book. Warm first-person tone.

### 6.3 Classes & Pricing
Four class cards (name, level, duration, description, typical slot, **Book →** which leads to the Schedule). Below, a dark "Choose your practice" pricing section with the plans from §5 (cards, perks, tags, "Get Started"). Footer strip: private session price, shareable packs, free cancellation.

### 6.4 Schedule
- Pulls **real upcoming sessions** (not hard-coded). One card per weekday showing the **soonest upcoming** occurrence; Friday shows "Rest".
- Each shows time, class, level, duration, and **spots left**. If full → show "Fully booked"/"Full" and disable booking.
- Clicking a day reveals a detail panel with a **Book This Class** button; a "Full week" list below also has **Book →**.
- Loading and error states are friendly (no blank page).
- "Good to know" box (hours, location, cancellation policy).

### 6.5 Contact
Left: email, phone, location, stylised map card with pin and "Open in maps". Right: **Send a message** form — name, email, interest dropdown (Hatha / Barre / Wheel / Chakra / Private session / General enquiry), message. Shows inline errors, a sending state, and a "Thank you — Priyanshi will be in touch within 24 hours" success state. **Must include a hidden honeypot field to deter bots.**

### 6.6 Join / Book (3-step flow)
1. **Plan** — pick plan (Free default, "Start here") + practice format (Online / In-person / Both). If Free is chosen but no class time is picked yet, direct the user to the Schedule first. Show the chosen class/time.
2. **Details** — full name, email. Summary of plan.
3. **Confirm/Payment** — for Free: submitting here books immediately and shows a **"You're in."** confirmation (class, day/time, email, and a **booking reference/token** to cancel later). For paid plans (Phase 1): show "Online payments are launching soon… book your free first class, or contact Priyanshi."
- Stepper UI (Plan · Details · Confirm/Payment), back buttons, inline server errors (e.g., "This email has already used its free class").

### 6.7 Admin dashboard (`/admin`, private)
Login screen (email + password). After login, one page showing:
- Stat tiles: **Total revenue**, **Total clients**, **New clients this month**, **Upcoming bookings**.
- **Earnings — last 6 months** bar chart (month vs AED).
- **Google Drive / Sheet link** (clickable) — editable.
- **Upcoming classes** (next ~10) with spots left / capacity.
- **Recent messages** from the contact form (name, email, snippet, date).
- **Settings:** Drive/Sheet link, and **notification email** (where booking/message alerts go).
- Log out. Must not be indexed by search engines.

## 7. Functional Requirements

### 7.1 Scheduling & availability
- FR-1: Weekly recurring class template generates concrete dated sessions for the **next ~8 weeks**, automatically (no manual creation).
- FR-2: Each session has a capacity and a live "spots left" count.
- FR-3: Times stored in UTC, displayed in Asia/Dubai (GMT+4).

### 7.2 Booking rules
- FR-4: **Free first class:** one per email address. A second attempt is rejected with a clear message. If a free class is cancelled 6+ hours ahead, it is given back and can be used for a **different** session (see FR-12).
- FR-4a: A person **cannot rebook a session they cancelled**. The server answers: "I'm so sorry — for any further queries please contact the YogaPriyanshi studio directly at <studio email>", where the studio email is the `studio_email` setting (never hard-coded). The booking form then offers the other open sessions.
- FR-5: A person cannot book the **same session twice**.
- FR-6: A **full** session cannot be booked; two people racing for the last seat must not both succeed (no overbooking).
- FR-7: Past / already-started sessions cannot be booked or cancelled.
- FR-8: Email is normalised (trim, lowercase) so `Sarah@x.com` and `sarah@x.com` are the same person.
- FR-9: Booking requires a session, name, valid email, and a mode (online / in-person).
- FR-10: Booking returns a **booking token**; the token (not an account) authorises later cancellation.

### 7.3 Credits & cancellation
- FR-11: Each booking consumes 1 credit from the person's plan/pack. Packs expire per §5 and cannot be used after expiry.
- FR-12: **Cancel ≥ 6 hours before** class → seat released **and credit refunded**. For a free first class, the free class is given back.
- FR-13: **Cancel < 6 hours before** class → seat released **but credit is burned**. For a free first class, it stays used.
- FR-14: Cancelling an already-cancelled booking is rejected; wrong token reveals nothing.

### 7.4 Contact
- FR-15: Messages are stored and visible in the admin dashboard; admin is emailed on new messages.
- FR-16: Honeypot-filled submissions are silently discarded (bot looks like it succeeded).

### 7.5 Notifications (email)
- FR-17: On booking → **confirmation email to the student** (class, date/time in Dubai time, format).
- FR-18: On booking, contact message (and later, purchase) → **alert email to the studio's notify address** (editable in admin).
- FR-19: Email failure must **never** block or roll back a booking.

### 7.6 Admin
- FR-20: Single admin account, password stored hashed; **lock out for 15 minutes after 5 failed logins**; session expires after ~2 hours.
- FR-21: Dashboard metrics per §6.7; settings editable and persisted.

### 7.7 Payments (Phase 2 — design for, don't build now)
- FR-22: Paid plans purchased through a **hosted checkout provider (e.g., Stripe Checkout)** — the site/server must **never see or store card numbers**. After successful payment a webhook marks the order paid and unlocks credits. Webhooks are signature-verified and idempotent.

## 8. Data Model (conceptual)
- **Class** (name, level, duration, description)
- **Schedule template** (class, weekday, start time, capacity)
- **Session** (dated instance of a template: start time UTC, capacity, booked count, status)
- **Customer** (email unique, name)
- **Plan** (key, label, price, credits, validity)
- **Order** (customer, plan, amount, status, credits total/remaining, expiry, access token)
- **Booking** (customer, session, order, mode, status, access token; unique per customer+session)
- **Contact message** (name, email, interest, message)
- **Admin user** (email, password hash, failed attempts, locked-until)
- **Settings** (key/value: drive link, notify email)

## 9. Non-Functional Requirements
- **Security:** input validation on every endpoint; rate limiting (stricter on writes and admin login); parameterised queries; secure headers; CORS locked down; secrets only in environment variables; hashed admin password; no card data stored.
- **Reliability:** all booking steps (capacity check, credit use, booking record) happen **atomically** — all succeed or none do.
- **Performance:** pages interactive in < 3s on mobile 4G; schedule loads in < 1s after page load.
- **Accessibility:** readable contrast, keyboard-usable forms, labelled inputs, sensible alt text.
- **SEO:** proper title/meta, shareable preview image; admin pages `noindex`.
- **Deployability:** one deployable unit (site + API + admin), runs on a free/cheap host, persistent database.
- **Error UX:** every failure (network, full class, duplicate, invalid input) shows a human-readable message, never a blank screen or raw error.

## 10. Edge Cases to Handle
Same email books free class twice · same session booked twice · last seat race · booking a past/started class · class becomes full while the user is on the form · cancel twice · cancel with wrong token · cancel after class started · expired pack · email with odd casing/whitespace · bots filling the contact form · very long/malicious input · API down (friendly error) · user reaches Join without picking a class · admin brute-force login · notification email fails.

## 11. Success Metrics
- ≥ 90% of started free-class bookings complete.
- Zero overbooked sessions; zero duplicate bookings.
- Every booking and message results in an email attempt to the studio.
- Admin can answer "how much did I earn this month and who are my clients?" in under 10 seconds from login.
- Site scores ≥ 90 on Lighthouse mobile performance & accessibility.

## 12. Phasing
- **Phase 1 (this build):** public site, live schedule, free-class booking, cancellation rules, contact form, email alerts, admin dashboard.
- **Phase 2:** Stripe Checkout for single/packs, credit redemption for pack holders, "manage my booking" page, custom domain + verified sending domain for email to arbitrary customers.
- **Phase 3 (ideas):** waitlist for full classes, reminder emails 24h before class, recurring-class auto-booking, WhatsApp notifications, testimonials CMS, blog.

## 13. Open Questions
1. Real phone number and final contact email?
2. Custom domain (`yogapriyanshi.com`?) — owned/registered yet? (Needed for sending email to any customer.)
3. Should Friday be bookable for private sessions only?
4. Final testimonial content and permission to use names.
5. Should "In-person" vs "Online" affect capacity limits separately?
