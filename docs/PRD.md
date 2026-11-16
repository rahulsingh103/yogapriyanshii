# YogaPriyanshi — Product Requirements Document (PRD)

**Version:** 2026-10-10 · **Owner:** Priyanshi (studio owner) · This is the one and only PRD for this website.

> **Part of the 8 project docs:** PRD · [DESIGN_SYSTEM](DESIGN_SYSTEM.md) · [ARCHITECTURE](ARCHITECTURE.md) · [DATABASE](DATABASE.md) · [SECURITY](SECURITY.md) · [CODE_STYLE](CODE_STYLE.md) · [TESTING](TESTING.md) · [AGENTS](../AGENTS.md)

## 0. Status (2026-10-10): what's built vs. this spec

| Area | Status |
|---|---|
| Public site | ✅ Built as one page in the "Mandala Bloom" design ([DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) §5 order): hero, "Choose your practice" carousel (10 classes), about (credentials and trust numbers), "What students say" (3 verified reviews), quote, "How it works" (3 steps, a safety note, a free 15-minute call link), live schedule, pricing, FAQ, "See Priyanshi in action" (5 Instagram photos), "Start with a trial class", contact. |
| Trial-class booking, rules, cancellation | ✅ Built and tested. The live site and the tests now run the same API (`backend/`). |
| Persistent database | ✅ Wired to Turso `yogapriyanshi-live` (production only; previews have none). Goes live once the env vars are set and `npm run db:migrate:live` has run. See [DATABASE.md](DATABASE.md). |
| Email alerts | ✅ Wired to Resend: student confirmations, plus booking, cancellation and contact alerts. Alerts go to the `notify_email` setting (**a test inbox during testing**, then Priyanshi's email at launch, changed in the admin settings). Students get mail from `EMAIL_FROM`, with replies going to the `studio_email` setting. |
| Admin dashboard | ✅ On the shared API with real numbers (revenue counts paid orders only, so it's 0 until payments exist). Sign-in needs `ADMIN_PASSWORD_HASH` to be set. |
| Payments | ⚠️ No online payment yet. Paid classes and packs are **reserved and paid at the studio** (the server accepts only `studio` as the payment method). Paid packs don't yet redeem credits on later bookings. Stripe Checkout comes later (§7.7). |
| FAQ | ✅ "Questions, answered" after Pricing: 10 fact-only answers (`src/constants/faq.ts`), with matching FAQPage JSON-LD in the HTML. Answers never mention WhatsApp, Zoom, props, priority booking, recordings or shared packs (students bring their own mat, so "mat" is allowed). |
| WhatsApp | ✅ Green floating button (one tap opens a chat with Priyanshi), plus links in Contact, in How it works ("Book a free 15-minute call", with its own prefill) and on the booking confirmation. Number: +971 50 895 5421 (`src/constants/contact.ts`). |
| New classes | Ashtanga, Spine Healing, Mobility Yoga and Prenatal & Postnatal are on the carousel as front-end content only. Their cards open the contact pop-up with the class preset; they join the timetable (DB) once Priyanshi confirms slots and durations. **Aerial Yoga is private sessions only, on request**: its card opens the contact pop-up with "Private Aerial Yoga" and it never goes on the schedule. |
| Class finder | ✅ "Find your class": a three-question pop-up (goal, experience, format) opened from three places: a "Find your class" button beside the hero's "Book a trial class", a "Take the quiz" band above the classes, and a dark "Take the quiz" first card in the carousel. While WhatsApp is enabled it then offers optional age, height and health questions, which go only into the WhatsApp message the student checks and sends. It suggests one class (plus an alternative, except for pregnancy) from a fixed table (`src/constants/class-finder.ts`). "Book this class" appears only for the 4 bookable classes in a group format and opens booking at the soonest session of that style (live online preselects "Online Live Stream"); every other result opens the contact pop-up with the matching interest. While WhatsApp is enabled it also offers "Ask Priyanshi on WhatsApp" with a prefill naming the answers and the class. Frontend only: no backend, data or analytics, and the optional answers never change the suggestion. |
| Monthly membership | ✅ A card in Pricing: "Monthly membership", AED 2,999 a month, with three perks (12 classes a month; recordings included, details shared when you join; in person in Dubai or live online). No priority booking and no shareable packs. "Join the membership" opens the contact pop-up preset to "Monthly membership" (FR-15b); the request is saved, alerts Priyanshi, and then offers "Continue on WhatsApp" with the person's name and the plan typed in. Priyanshi tracks requests in the admin Members tab (New → Contacted → Active with a start date). No payment or credits: she arranges those with the member. Needs migration 004 on the live database before release. |
| Class pages | ✅ (Batch 4a, 2026-10-26) One page per class at `/classes/<slug>` (9; Aerial removed 2026-11-14), opened from each carousel card's "Learn more" (no reload) or directly. Each page is prerendered at build time with its own title, description, canonical and Open Graph tags, and readable without JavaScript. It shows who it's for, about, duration (none for Aerial), intensity, level (the 5 timetabled classes), format, what to bring, any notice, a matching review, and one honest action: "Book a trial class" for Hatha, Barre, Chakra Flow, Vinyasa and Yin Yoga; "Ask about this class" for the 4 classes not on the timetable (with the line "Not on the timetable yet. Send a message and Priyanshi will find a time with you. In person in Dubai or live online."); "Ask about private Aerial" for Aerial. Unknown paths are real 404s (noindex). `sitemap.xml` and `robots.txt` are generated. The photos are real photos of Priyanshi until the shoot; the intensity labels and the new classes' durations wait for her check. Articles ("Guides") are not public yet (4b). |
| Guides (articles) | ✅ Live 2026-11-15: four guides approved by Priyanshi (first class, choosing a style, stiff back, prenatal). Built in Batch 4b (2026-10-26). The pipeline is ready: Markdown articles in `src/content/articles/` become `/guides/<slug>` pages (prerendered, in the sitemap) with a `/guides` index and a footer "Guides" link, all of which appear only once an article is published. Four drafts (your first class, which style, a stiff back, prenatal basics) wait outside the repo for Priyanshi's review; none is published, so `/guides` is a 404 today. Publishing needs her written OK and checked sources. |
| Student accounts | ✅ Optional. "Log in" and "Sign up" in the header open a sheet that works with a 6-digit code sent by email: no password and no name. A signed-in student sees their email, an offers setting and Log out. Reading and booking never need an account, and accounts aren't linked to bookings. Needs migration 006 and `ACCOUNT_SECRET` before release. See FR-23 to FR-28. |
| Offer emails | ✅ Email only and opt-in. Priyanshi writes an offer in the admin Offers tab, checks the exact email and sends it to the students who chose to get offers. Every offer email has an unsubscribe link that needs no login. |
| Testimonials | ✅ Three real, verified ClassPass reviews, quoted exactly (`src/constants/testimonials.ts`), captioned "Verified ClassPass review · <class> class". No venue names and no links to review sites (they name a former studio). |

**Still to fill in:** real photos for the class cards (AI placeholders today), and the slots and durations of the new classes. The booking pop-up still says "Pay in Person" only, while Pricing and the FAQ also mention online payment details (follow-up).

---

---

## 1. Overview

**YogaPriyanshi** is the website and booking system for a solo yoga instructor based in Dubai, UAE. Prospective students discover Priyanshi's classes, see a real weekly schedule with live availability, and book a class — starting with a **AED 90 trial class** — without needing an account. Priyanshi gets a private dashboard to see bookings, clients, revenue and messages, and is notified when someone books or writes in.

**One-line pitch:** *A calm, premium, mobile-friendly site where a student can go from "who is this?" to "I'm booked for Monday 7am" in under two minutes.*

## 2. Goals & Non-Goals

### Goals
1. Convert visitors into booked students, with the **AED 90 trial class** as the main on-ramp.
2. Show **real, live availability** (spots left per class) so nobody books a full class.
3. Enforce Priyanshi's booking rules automatically (capacity, no double-booking, cancellation policy).
4. Give Priyanshi a simple private dashboard and email alerts so she never has to chase information.
5. Look and feel like a boutique wellness brand: quiet, warm, editorial — not a generic template.

### Non-Goals (Phase 1)
- Real online payments (card checkout) — the paid plans are shown, but paid purchase shows a "launching soon" message. Payments are Phase 2.
- Passwords, social login or anything that makes an account necessary. Student accounts are optional and work by email code (FR-23).
- Multiple instructors, multi-studio, or multi-language support.
- Video hosting / on-demand class library.

## 3. Users

| User | Description | Primary need |
|---|---|---|
| **Prospective student** | Dubai-based (or remote) adult, mobile-first, found Priyanshi via Instagram/ClassPass/word of mouth | Quickly understand the classes, see times, book a trial class |
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

**Location:** no public studio address (changed 2026-10-17). Classes are "in person in Dubai or online". After booking, Priyanshi confirms where and how with the student by message. The site, emails and calendar invites never show an address. Payment for in-person classes is "Pay in Person" (the internal value stays `pending_at_studio`).
**Email shown on site:** priyanshi@yogapriyanshi.com · **Phone:** placeholder `+971 50 000 0000` (to be replaced)
**Instagram:** @yogapriyanshi. Don't link ClassPass or FindYoga: those pages name her former studio, which the site never names (it's described as "one of the UAE's largest yoga studios").
**Credibility (About, updated 2026-11-05 by the owner):** teaching for 10+ years (no start year shown) · Yoga Alliance registered, 300-hour training in Rishikesh · Bachelor's in Yogic Science (Dev Sanskriti Vishwavidyalaya) · up to 500 people led on International Yoga Day · trained in prenatal yoga. The source of truth is the private fact sheet (`design/PRIYANSHI-FACTS.md` in the workspace).
**Hero:** title "YogaPriyanshi", tagline **"Connect with your body."**, style list "Hatha · Barre · Chakra Flow · Vinyasa · Yin", CTAs "Begin your journey" (→ Join) and "View classes".
**Timezone:** all times shown in UAE time (GMT+4). **Studio hours:** Mon–Sun 6:30 AM – 8:00 PM. All classes available online and in person.

### Classes (5 timetabled styles)
| Class | Level | Duration | Description |
|---|---|---|---|
| Hatha Yoga | All levels | 60 min | The classical root of the practice — foundational postures, precise alignment, and the relationship between breath and movement. No experience necessary. |
| Barre Yoga | All levels | 60 min | Strength work woven with deep, intentional stretching. Small controlled movements build heat and tone, then long holds open everything back up. |
| Chakra Yoga Flow | Beginner friendly | 60 min | A moving meditation through the body's energy centres, pairing breath, sound, and sequence. Grounding, clearing, and deeply restorative. |
| Vinyasa Yoga | Some experience | 60 min | A breath-led flow from pose to pose. Each movement follows the breath, so the class builds strength and focus as it moves along. |
| Yin Yoga | All levels | 75 min | Long, quiet holds, mostly seated or lying down, that give your body time to slow down and let go. A calm, still practice. |

### Weekly schedule (recurring, Dubai time)
| Day | Time | Class | Capacity |
|---|---|---|---|
| Monday | 7:00 AM | Barre Yoga | 12 |
| Tuesday | 6:00 PM | Hatha Yoga | 12 |
| Wednesday | 7:00 AM | Barre Yoga | 12 |
| Thursday | 6:00 PM | Vinyasa Yoga | 12 |
| Friday | 7:00 AM | Yin Yoga | 12 |
| Saturday | 9:00 AM | Chakra Yoga Flow | 15 |
| Sunday | 10:00 AM | Hatha Yoga | 12 |

### Plans & pricing (currency: AED)
| Plan | Price | Credits | Validity | Notes |
|---|---|---|---|---|
| Trial class | AED 90 | 1 | — | Any style, **one per person (email) ever** |
| Single class | AED 300 | 1 | No expiry | Drop in once |
| 10-class pack | AED 2,800 | 10 | 45 days | AED 280/class; "Most popular" tag; class recordings (7 days) |
| 20-class pack | AED 5,200 | 20 | 75 days | AED 260/class, save AED 400; "Best value" tag; 1 private session included; priority booking |
| Private 1-to-1 | AED 500 / 60 min | — | — | Mentioned as an add-on |

**Changed 2026-11-05 (owner's launch notes):** the free first class became a paid AED 90 trial, still one per email, with the new prices above. Bookings made before this stay AED 0. In the code and database the trial keeps the plan key `free`; see [DATABASE.md](DATABASE.md).

Extra pricing-page notes: *Packs are shareable (bring a friend on your credits). Free cancellation up to 24 hours before class.*

### Policies (display verbatim on Schedule page "Good to know")
- Cancellation rule (owner-approved 2026-11-14, `src/constants/cancel-policy.ts`): **free up to 24 hours** before class; **under 24 hours but not on the day** (Dubai time), the class can be moved **once** per pack or trial and the credit comes back; **on the day**, the credit is used (a trial counts as used and AED 90 is due). The same rule applies to the trial. Packs and memberships are non-refundable; Priyanshi may extend dates for illness or travel. Membership minimum 3 months.

### Page copy tone
Warm, short, confident, second-person ("Start with a trial class for AED 90."). Avoid hype and exclamation marks.

## 6. Site Map & Page Requirements

### 6.1 Home
Hero (see §5), credibility strip, "Five paths" section introducing the 5 classes, a student-testimonials section (can be toggled on/off), a short "A minute with Priyanshi" intro, an "From the studio" Instagram-style photo strip linking to her Instagram, a closing CTA to book. Footer on every page with nav + Join link.

**As built (2026-10-25, entry points and optional details 2026-11-05), the class finder:** "Find your class" beside the hero's "Book a trial class", the "Take the quiz" band above the classes, the dark first card in the carousel and "Take the quiz" on an article page all open the **Find your class** pop-up. Three questions, one per step (What would you like yoga to give you? · How much yoga have you done? · How would you like to practise?), then one suggested class with a short reason, its length (none for Aerial), the format note and one honest action:
- a bookable class (Hatha, Barre, Chakra Flow, Vinyasa, Yin Yoga) in person or online: "Book this class", plus "Your first class is a trial at AED 90.";
- a class not on the timetable (Ashtanga, Spine Healing, Mobility Yoga, Prenatal & Postnatal): "Ask about this class" (contact pop-up with that class as the interest);
- private: "Ask about a private session" (interest "Private session"), Prenatal "Ask about this class" ("Prenatal & Postnatal").
Pregnancy always suggests Prenatal & Postnatal with no alternative and a note to tell Priyanshi before the first class. Aerial Yoga was removed 2026-11-14: private answers use the same table and ask for a private session. No medical or clearance wording.

**Optional details (owner decision 2026-11-05: they travel in the wa.me link, with a plain note before and at the result).** While WhatsApp is enabled, after question 3 comes an intro ("A few details for Priyanshi"), then age and height, health conditions, medication (now or in the past), and injury, surgery or pain, each skippable. "Skip to my suggestion" clears anything entered. Rules:
- The answers never change the suggestion, its action or its copy, and the free text is never parsed.
- They live only in the open pop-up's memory and in the wa.me link. No request to our server, no storage, no logs, no URL on our domain. They are cleared on every close, on "Start again" and on "Remove my answers".
- The student is told before typing, and again at the result, that opening the message shares the text with WhatsApp and that the browser may keep the link in its history. It only reaches Priyanshi if they press send.
- Booking and the contact form never include them; a note above the button says so. The main action stays first; the message and its "Send this on WhatsApp" button come after it.
- The notice is "Please tell Priyanshi about anything you've noted here before your first class." It shows only when the goal has no notice of its own. No doctor line and no advice.
- Age 5-110 and height 100-250 are typo guards only. There is no age gate. A link over 2,000 characters has its longest note shortened and marked with an ellipsis, and the student is told.

### 6.1a Class pages (as built 2026-10-26)
- **URLs:** `/classes/hatha`, `/classes/barre`, `/classes/chakra-flow`, `/classes/vinyasa`, `/classes/ashtanga`, `/classes/spine-healing`, `/classes/mobility-yoga`, `/classes/yin-yoga`, `/classes/prenatal-postnatal`, `/classes/aerial-yoga`. A trailing slash works; any other path, including a different letter case, is a 404 page ("Page not found", with links home and to the classes). The retired `/classes/wheel` is a 404 locally; on Vercel, `vercel.json` redirects it (308, with or without a trailing slash) to `/classes/spine-healing`.
- **Content** (`src/constants/class-pages.ts`, facts only): the back link "All classes", the class name, the class card's photo, "Who it's for", "About the class", Duration · Intensity · Level · Format, "What to bring" (6 items from the owner's before-class answers), a back or pregnancy notice where it applies, the Barre and Spine Healing reviews on their pages, then the action line and buttons. While WhatsApp is on, "Ask Priyanshi on WhatsApp" prefills "Hi Priyanshi, I found you on yogapriyanshi.com and I'd like to know more about your <Name> class."
- **Honest actions:** "Book" and the trial class appear only on the 5 timetabled classes. No cure, treat, heal (the class name aside), guarantee, "safe for" or prevent wording, no doctor line, and never the video tool or the former studio.
- **Navigation:** Back (or "All classes") returns to the carousel at the same card with its "Learn more" focused. From a class page, the header and footer links go home and then to the section.
- **SEO:** title "<Name> in Dubai · YogaPriyanshi", a unique description (155 characters at most), canonical `https://www.yogapriyanshi.com/classes/<slug>`, the shared OG image. `sitemap.xml` lists home and the 10 classes.

### 6.1b Guides (built 2026-10-26, live 2026-11-15 with four guides)
- **URLs:** `/guides/<slug>` for each published article and `/guides` (the index, newest first). Both exist only once at least one article is published; until then they are 404s, the footer has no "Guides" link and the sitemap has no guides.
- **Content:** title, a one-line description, the article (headings, paragraphs, bullets, https links to sources), then "Book a trial class" and "Take the quiz" (an article about an on-request class, such as prenatal, shows the on-request line and "Ask about this class" instead of booking). Each article is original, 600–900 words, with facts about Priyanshi only from her verified facts and every source checked before publishing. Only the back-pain and prenatal guides carry a "see a doctor or physiotherapist" / "check with your midwife or doctor" line.
- **SEO:** title "<Article title> · YogaPriyanshi", the article's description, canonical `https://www.yogapriyanshi.com/guides/<slug>`, prerendered at build time.
- **Review and publishing:** drafts stay outside the repo; the owner previews them on a local dev server (`SHOW_DRAFTS=1`) and sends them to Priyanshi; an article is published only after her written OK (`status: published`, the date and `reviewedBy`) and once every source is checked (the build refuses any "(link to verify)" or "URL to confirm" left in it).

### 6.2 About
"Hello, I'm Priyanshi" hero; her story ("A path that began…"); philosophy/approach; CTA to book. Warm first-person tone.

### 6.3 Classes & Pricing
Five class cards (name, level, duration, description, typical slot, **Book →** which leads to the Schedule). Below, a dark "Choose your practice" pricing section with the plans from §5 (cards, perks, tags, "Get Started"). Footer strip: private session price, shareable packs, free cancellation.

**As built (2026-10-25):** Pricing is the four plan rows (trial, single, 10-pack, 20-pack) plus, beside them from desktop width and below them on phones, the **monthly membership** card: "Monthly membership", "AED 2,999 a month", the perks "12 classes a month", "Recordings included (details shared when you join)" and "In person in Dubai or live online", and the button "Join the membership" (FR-15b). No tags, no "Most popular", no per-class price and no priority booking or shareable packs. The copy lives in `src/constants/membership.ts`.

### 6.4 Schedule
- Pulls **real upcoming sessions** (not hard-coded). One card per weekday showing the **soonest upcoming** occurrence. Every day has a class; a day with none on the template (a fallback) shows "No class".
- Each shows time, class, level, duration, and **spots left**. If full → show "Fully booked"/"Full" and disable booking.
- Clicking a day reveals a detail panel with a **Book This Class** button; a "Full week" list below also has **Book →**.
- Loading and error states are friendly (no blank page).
- One "good to know" line (free cancellation up to 24 hours before) next to the "Cancel / Manage Reservation" button.

### 6.5 Contact
The section is a heading ("Get in touch"), the studio address and a **"Contact Priyanshi"** button that opens the **Send a message** pop-up: name, email, **phone (optional)**, interest dropdown (General enquiry / Hatha / Barre / Chakra / Spine Healing / Mobility Yoga / Yin Yoga / Prenatal & Postnatal / Vinyasa Yoga / Ashtanga Yoga / Private Aerial Yoga / Private session / Monthly membership / Class Packs & Corporate), message. With "Monthly membership" selected (preset by "Join the membership", or picked from the list) the pop-up is in **membership mode**: title "Join the membership", an optional "In person or online" choice, and the message becomes the optional "Preferred days and times" (FR-15b). A not-yet-scheduled class card opens the same pop-up with that class preset as the interest. Shows inline errors, a sending state, and a "Thank you — Priyanshi will be in touch within 24 hours" success state. **Must include a hidden honeypot field to deter bots.**

### 6.5a FAQ and WhatsApp
- **FAQ** ("Questions, answered"), after Pricing, 7 questions: beginners, where, what to bring or wear, pricing, private sessions, payment, cancellation. Facts only, in line with §5 and §7 as built (no shared packs, priority booking or recordings yet). Recordings are part of the monthly membership, but they appear on the membership card only: the FAQ and its JSON-LD stay unchanged and never mention them. Payment: in person at the session, or for online classes with the details Priyanshi sends after booking (no method named).
- **Before class** (FAQ and How it works): comfortable clothes and water, your own mat for in-person classes, no heavy meal for 2 hours before, arrive or log in 5 to 10 minutes early, tell Priyanshi about injuries, health conditions or pregnancy beforehand. Online students get the class link from Priyanshi (the video tool is never named).
- **WhatsApp** (Priyanshi's number +971 50 895 5421, set in `src/constants/contact.ts`): a green floating button that opens WhatsApp in one tap with the first message typed in, a secondary link in Contact, and a link on the booking confirmation. All three open `wa.me/971508955421` in a new tab; nothing goes through the backend.

### 6.6 Join / Book (3-step flow)
1. **Plan** — pick plan (Trial default) + practice format (Online / In-person / Both). If the trial is chosen but no class time is picked yet, direct the user to the Schedule first. Show the chosen class/time.
2. **Details** — full name, email. Summary of plan.
3. **Confirm/Payment** — submitting here books immediately and shows a **"You're in."** confirmation (class, day/time, email, and a **booking reference/token** to cancel later). There is no payment step (Phase 1): in person, the student pays at the session; online, Priyanshi sends the payment details.
- Stepper UI (Plan · Details · Confirm/Payment), back buttons, inline server errors (e.g., "This email has already used its trial class").

### 6.7 Admin dashboard (`/admin`, private)
Login screen (email + password). After login, one page showing:
- Stat tiles: **Total revenue**, **Total clients**, **New clients this month**, **Upcoming bookings**.
- **Earnings — last 6 months** bar chart (month vs AED).
- **Google Drive / Sheet link** (clickable) — editable.
- **Upcoming classes** (next ~10) with spots left / capacity.
- **Recent messages** from the contact form (name, email, phone as a tap-to-call link when given, interest, message, date). A membership request without preferred times shows no message block.
- **Offers tab** (as built 2026-11-07): FR-27.
- **Members tab** (as built 2026-10-25): the dashboard's tabs are **Overview** (everything above and below, the default), **Members** and **Offers**. Members lists the membership requests, newest first, 20 per page, with a filter (All / New / Contacted / Active, each with its count). Each request shows the name, email and phone links, the plan and price, the format, the preferred times, the request date and, when Active, the start date. Priyanshi moves it one step at a time: New → Contacted → Active (with a start date within a year either side of today), and back one step. Leaving Active clears the start date.
- **Settings:** Drive/Sheet link, and **notification email** (where booking/message alerts go).
- Log out. Must not be indexed by search engines.

## 7. Functional Requirements

### 7.1 Scheduling & availability
- FR-1: Weekly recurring class template generates concrete dated sessions for the **next ~8 weeks**, automatically (no manual creation).
- FR-2: Each session has a capacity and a live "spots left" count.
- FR-3: Times stored in UTC, displayed in Asia/Dubai (GMT+4).

### 7.2 Booking rules
- FR-4: **Trial class (AED 90):** one per email address. A second attempt is rejected with a clear message. If a trial class is cancelled 6+ hours ahead, it is given back and can be used for a **different** session (see FR-12).
- FR-4a: A person **cannot rebook a session they cancelled**. The server answers: "I'm so sorry — for any further queries please contact the YogaPriyanshi studio directly at <studio email>", where the studio email is the `studio_email` setting (never hard-coded). The booking form then offers the other open sessions.
- FR-5: A person cannot book the **same session twice**.
- FR-6: A **full** session cannot be booked; two people racing for the last seat must not both succeed (no overbooking).
- FR-7: Past / already-started sessions cannot be booked or cancelled.
- FR-8: Email is normalised (trim, lowercase) so `Sarah@x.com` and `sarah@x.com` are the same person.
- FR-9: Booking requires a session, name, valid email, and a mode (online / in-person).
- FR-10: Booking returns a **booking token**; the token (not an account) authorises later cancellation.

### 7.3 Credits & cancellation
- FR-11: Each booking consumes 1 credit from the person's plan/pack. Packs expire per §5 and cannot be used after expiry.
- FR-12: **Cancel ≥ 24 hours before** class → seat released **and credit refunded**. For a trial class, it can be booked again for a different session. Under 24 hours but not on the day → refunded once per pack (or trial) as the one late move.
- FR-13: **Cancel on the day of the class**, or a second late move → seat released **but credit is burned**. For a trial class, it stays used.
- FR-14: Cancelling an already-cancelled booking is rejected; wrong token reveals nothing.

### 7.4 Contact
- FR-15: Messages are stored and visible in the admin dashboard; admin is emailed on new messages.
- FR-15b: **Membership requests.** A contact message with interest "Monthly membership" is a membership request. Its message (preferred days and times) is optional, up to 2,000 characters with no control characters (each refused with its own message), stored as empty when not given. An optional `format` (`in_person` or `online`) is validated on the server and ignored for every other interest. In the same transaction as the message, the server stores a membership request row with the plan's label and price at that moment (`12-class monthly membership`, AED 2,999), status New and no start date. The alert adds "Plan" and, when given, "Format" lines ("No preferred times given." when the message is empty). The reply is the same as any message. Status changes (admin only) go one step at a time, need the status the admin last saw (otherwise 409, "updated elsewhere"), and Active needs a real start date within 365 days of today in Dubai. Nothing is paid or credited by a request.
- FR-16: Honeypot-filled submissions are silently discarded (bot looks like it succeeded).
- FR-16a: Phone is optional. When given it's validated on the server (one line, at most 30 characters, digits with an optional leading +, spaces, brackets and dashes, 6–15 digits), stored, shown in admin and included in the alert. When empty it's stored as NULL. It never appears in logs.

### 7.5 Notifications (email)
- FR-17: On booking → **confirmation email to the student** (class, date/time in Dubai time, format).
- FR-18: On booking, contact message (and later, purchase) → **alert email to the studio's notify address** (editable in admin).
- FR-19: Email failure must **never** block or roll back a booking.

### 7.6 Admin
- FR-20: Single admin account, password stored hashed; **lock out for 15 minutes after 5 failed logins**; session expires after ~2 hours.
- FR-21: Dashboard metrics per §6.7; settings editable and persisted.

### 7.6a Student accounts and offers (2026-11-07)
- FR-23: **Accounts are optional.** Every page, booking and cancellation works without one, and an anonymous visit makes no account request. Sign-up asks for an email and an unticked offers box, nothing else. No account exists until the code is verified. No names, booking history, prefill or email change.
- FR-24: **Email codes.** 6 digits, valid for 10 minutes, single use, 5 attempts, and a new request replaces the old code. The reply to a code request is the same for every email: an address with an account gets a code, and logging in with an unknown address gets a "No account yet" email and no code. A send that fails answers honestly and shows no code step.
- FR-25: **Limits.** Per email: 1 a minute, 5 an hour and 10 a day. Per IP: 20 code requests and 60 code checks an hour. A daily cap on account emails protects the mail allowance booking needs. **While that cap is hit, nobody can sign up or log in until it resets (up to 24 hours); booking is unaffected.** The caps (30 account emails and 50 offer emails a day) are provisional until the mail plan is confirmed.
- FR-26: **Offers consent.** The box says "Email me monthly and holiday offers from Priyanshi. I can unsubscribe at any time." It's stored only after verification, with the time and the wording's version. It can be changed in the account view. For a new account, the code email says whether entering it turns offers on, and straight after verifying the account view says whether offers are on or off.
- FR-27: **Sending offers (admin Offers tab).** Subject up to 120 characters on one line, message up to 5,000, plain text. The review shows the exact email and "Send to N subscribers". One send at a time, to the verified, opted-in accounts at that moment; nobody's address is shown or exported. Each recipient gets at most one copy: a failed or interrupted send is counted as "not delivered" and never retried. Someone who unsubscribes mid-send is skipped. A closed tab shows "Continue sending". The daily cap pauses a send, and it can continue later.
- FR-28: **Unsubscribe.** Every offer email has a link and the `List-Unsubscribe` headers. The page never shows the email, opening it changes nothing, and its one button (or a mail app's one-click) unsubscribes without a login. Login codes and booking emails carry no unsubscribe link.

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
- **Contact message** (name, email, optional phone, interest, message)
- **Membership request** (one contact message; plan key, label and price snapshot, optional format, status New / Contacted / Active, start date while Active)
- **Admin user** (email, password hash, failed attempts, locked-until)
- **Settings** (key/value: drive link, notify email)
- **Account** (email, offers setting, consent time and version, unsubscribe token), its **sessions**, **login codes** and **rate limits**
- **Offer** (subject, body, status) and **offer recipient** (one per account, status)

## 9. Non-Functional Requirements
- **Security:** input validation on every endpoint; rate limiting (stricter on writes and admin login); parameterised queries; secure headers; CORS locked down; secrets only in environment variables; hashed admin password; no card data stored.
- **Reliability:** all booking steps (capacity check, credit use, booking record) happen **atomically** — all succeed or none do.
- **Performance:** pages interactive in < 3s on mobile 4G; schedule loads in < 1s after page load.
- **Accessibility:** readable contrast, keyboard-usable forms, labelled inputs, sensible alt text.
- **SEO:** proper title/meta, shareable preview image; admin pages `noindex`.
- **Hidden from search (owner decision 2026-11-15, until Priyanshi's visa arrives):** `vercel.json` sends `X-Robots-Tag: noindex, nofollow` on every path, so Google and Bing drop the site while it stays online for anyone with the link. robots.txt stays open on purpose (a crawler must read the pages to see the noindex). To undo: delete the `headers` block in `vercel.json`, deploy, then resubmit the sitemap in Search Console and Bing.
- **Deployability:** one deployable unit (site + API + admin), runs on a free/cheap host, persistent database.
- **Error UX:** every failure (network, full class, duplicate, invalid input) shows a human-readable message, never a blank screen or raw error.

## 10. Edge Cases to Handle
Same email books the trial class twice · same session booked twice · last seat race · booking a past/started class · class becomes full while the user is on the form · cancel twice · cancel with wrong token · cancel after class started · expired pack · email with odd casing/whitespace · bots filling the contact form · very long/malicious input · API down (friendly error) · user reaches Join without picking a class · admin brute-force login · notification email fails.

## 11. Success Metrics
- ≥ 90% of started trial-class bookings complete.
- Zero overbooked sessions; zero duplicate bookings.
- Every booking and message results in an email attempt to the studio.
- Admin can answer "how much did I earn this month and who are my clients?" in under 10 seconds from login.
- Site scores ≥ 90 on Lighthouse mobile performance & accessibility.

## 12. Phasing
- **Phase 1 (this build):** public site, live schedule, trial-class booking, cancellation rules, contact form, email alerts, admin dashboard.
- **Phase 2:** Stripe Checkout for single/packs, credit redemption for pack holders, "manage my booking" page, custom domain + verified sending domain for email to arbitrary customers.
- **Phase 3 (ideas):** waitlist for full classes, reminder emails 24h before class, recurring-class auto-booking, WhatsApp notifications, testimonials CMS, blog.

## 13. Open Questions
1. Real phone number and final contact email?
2. Custom domain (`yogapriyanshi.com`?) — owned/registered yet? (Needed for sending email to any customer.)
3. ~~Final testimonial content~~ Resolved 2026-10-19: three verified ClassPass reviews, unnamed.
4. Should "In-person" vs "Online" affect capacity limits separately?
