You are working on my YogaPriyanshi studio app (the one you built for me here). GitHub repo: https://github.com/rahulsingh103/yogapriyanshii (branch `main`, last commit "Streamline hero mobile copy and eliminate clutter").

I ran a full Playwright end-to-end test pass on a local clone of that repo. It found real bugs, which I fixed, and I added a test suite. I want YOU to:
1. Check your current copy of the project against the GitHub `main` above. If your copy has moved on, apply my changes on top of it and tell me about any conflicts.
2. Review every change below and confirm it is correct. Push back if anything is wrong.
3. Apply the changes exactly as given (full file contents below).
4. Push to GitHub on a new branch called `add-playwright-tests`, NOT straight to `main` (pushing to `main` redeploys the live Vercel site). Then tell me what you pushed.

Do NOT change anything else, especially:
- Do not touch `api/index.ts` (the Vercel serverless API). I know it's a cut-down copy of `server.ts` with no contact, admin or email routes and no free-class or 6-hour rules. That's a separate job.
- Do not add any email sending. I'm connecting the email service myself next.
- Do not commit `package-lock.json`. This project uses `bun.lock`. Please regenerate `bun.lock` so it includes the `package.json` changes below.

==================================================================
SUMMARY OF CHANGES
==================================================================

A) BUG FIX: `src/services/api.ts` (the only change to how the site behaves)
Problem: every API call swallowed server errors and fell back to fake local success. Effects the tests caught:
  - Booking the free first class twice with the same email showed a fake "You're on the mat" confirmation instead of the server's "This email has already used its free first class" error.
  - Admin login never showed "X attempts remaining" or the 15-minute lockout message.
  - SECURITY: during a server lockout, the client fallback still logged in anyone who typed `Priyanshi2026!` (it handed out a fake token), and then showed fake dashboard stats.
  - An expired or invalid admin token showed fake stats instead of logging out.
Fix: added a small `ApiError` class plus `serverError()` and `rethrowApiError()` helpers. If the server answers with a JSON `{ error }`, that error is thrown to the UI. The offline fallbacks still apply when the server is unreachable or answers without a JSON error. For `getBooking` and `cancelBooking`, a server 404 still checks localStorage first (Vercel's in-memory store can lose bookings between instances). `askMathTutor` is unchanged.

B) `server.ts`: one line. `const PORT = 3000;` becomes `const PORT = Number(process.env.PORT) || 3000;` so tests can start their own server on port 3100. Default behaviour is unchanged.

C) `package.json`:
  - `esbuild` goes from `^0.25.0` to `^0.28.0`. `npm install` failed with an ERESOLVE conflict because Vite 8 needs esbuild 0.27 or later.
  - Added devDependency `"@playwright/test": "^1.64.0"`.
  - Added script `"test:e2e": "playwright test"`.
  - (npm also re-sorted the dependency list alphabetically. That's cosmetic only.)

D) `.gitignore`: added `test-results/` and `playwright-report/`.

E) NEW: `playwright.config.ts` plus an `e2e/` folder with 23 tests in 6 files and one helper file. Tests run one at a time against a fresh `npx tsx server.ts` on port 3100, and save a screenshot of every step to `test-results/screenshots/<feature>/`. Coverage:
  - 01-landing: all sections and images load, nav links, sticky book bar, "Book This Style", pricing buttons preselect the package, schedule week tabs and "Book This Class".
  - 02-booking: free-class happy path with validation, duplicate free class rejected, pay at studio, card (requires card, "Use Test Card"), bank transfer, Back button, API rules (double booking, invalid email, missing fields, rest day, full class).
  - 03-manage-booking: look up by token, cancel (refunded, seat released), already-cancelled state, unknown token error.
  - 04-contact: form sends and reaches the admin inbox, honeypot discarded, missing fields rejected.
  - 05-admin: wrong password shows attempts left, dashboard tiles/chart/table/messages, settings persist across reload, logout, API rejects missing or bad tokens, lockout after 5 failures blocks even the correct password.
  - 06-mobile (390x844): no horizontal scroll, mobile menu, free booking end to end.
Result: all 23 pass. With the old `api.ts`, the duplicate-free-class and both admin tests fail, which confirms the fix is what makes them pass.
Run the tests with: `npm install && npx playwright install chromium && npm run test:e2e` (needs Node 20 or newer).

Known issues I'm NOT fixing now (just be aware of them):
  - The admin login screen shows the password ("Default credentials: Priyanshi2026!") to every visitor.
  - On Vercel, `api/index.ts` lacks the contact, admin and email routes and the free-class and 6-hour rules, so the live site falls back to client-side fake behaviour for those.
  - The Math Tutor view and the Email Inbox modal exist in the code, but nothing in the UI opens them.

==================================================================
FULL FILE CONTENTS AND DIFFS
==================================================================

----- DIFF: src/services/api.ts -----
```diff
diff --git a/src/services/api.ts b/src/services/api.ts
index 107b1df..92c7dd7 100644
--- a/src/services/api.ts
+++ b/src/services/api.ts
@@ -118,6 +118,27 @@ function generateFallbackSchedule(): ClassSession[] {
   return sessions;
 }
 
+// Errors the server deliberately returned (validation, auth, lockout) must reach the UI.
+// The local fallbacks below only apply when the API is unreachable or answers without one.
+class ApiError extends Error {
+  constructor(message: string, public status: number) {
+    super(message);
+  }
+}
+
+async function serverError(res: Response): Promise<ApiError | null> {
+  if (res.ok) return null;
+  try {
+    const data = await res.json();
+    if (data?.error) return new ApiError(data.error, res.status);
+  } catch {}
+  return null;
+}
+
+function rethrowApiError(err: unknown) {
+  if (err instanceof ApiError) throw err;
+}
+
 export const api = {
   async getClasses(): Promise<YogaClass[]> {
     try {
@@ -163,7 +184,10 @@ export const api = {
       if (res.ok) {
         return await res.json();
       }
-    } catch {
+      const err = await serverError(res);
+      if (err) throw err;
+    } catch (err) {
+      rethrowApiError(err);
       // Fall through to resilient local handler
     }
 
@@ -230,12 +254,18 @@ export const api = {
   },
 
   async getBooking(token: string): Promise<{ booking: Booking; session: ClassSession }> {
+    let notFound: ApiError | null = null;
     try {
       const res = await fetch(`/api/bookings/${encodeURIComponent(token)}`);
       if (res.ok) {
         return await res.json();
       }
-    } catch {}
+      const err = await serverError(res);
+      if (err && err.status !== 404) throw err;
+      notFound = err;
+    } catch (err) {
+      rethrowApiError(err);
+    }
 
     // Check localStorage fallback
     try {
@@ -248,7 +278,7 @@ export const api = {
       }
     } catch {}
 
-    throw new Error('No reservation found for this booking token.');
+    throw notFound || new Error('No reservation found for this booking token.');
   },
 
   async cancelBooking(token: string): Promise<{ booking: Booking; message: string; noticeHours: number }> {
@@ -261,7 +291,11 @@ export const api = {
       if (res.ok) {
         return await res.json();
       }
-    } catch {}
+      const err = await serverError(res);
+      if (err && err.status !== 404) throw err;
+    } catch (err) {
+      rethrowApiError(err);
+    }
 
     // Cancel in localStorage fallback
     try {
@@ -292,7 +326,11 @@ export const api = {
         body: JSON.stringify(payload),
       });
       if (res.ok) return await res.json();
-    } catch {}
+      const err = await serverError(res);
+      if (err) throw err;
+    } catch (err) {
+      rethrowApiError(err);
+    }
     return { success: true, message: 'Thank you! Your message has been sent to Priyanshi.' };
   },
 
@@ -304,7 +342,11 @@ export const api = {
         body: JSON.stringify({ password }),
       });
       if (res.ok) return await res.json();
-    } catch {}
+      const err = await serverError(res);
+      if (err) throw err;
+    } catch (err) {
+      rethrowApiError(err);
+    }
     if (password === 'Priyanshi2026!') {
       return { token: 'admin_session_token_' + Date.now(), message: 'Logged in successfully.' };
     }
@@ -317,7 +359,11 @@ export const api = {
         headers: { Authorization: `Bearer ${token}` },
       });
       if (res.ok) return await res.json();
-    } catch {}
+      const err = await serverError(res);
+      if (err) throw err;
+    } catch (err) {
+      rethrowApiError(err);
+    }
     const schedule = generateFallbackSchedule();
     const stored: Booking[] = JSON.parse(localStorage.getItem('yp_local_bookings') || '[]');
     return {
@@ -352,7 +398,11 @@ export const api = {
         body: JSON.stringify(settings),
       });
       if (res.ok) return await res.json();
-    } catch {}
+      const err = await serverError(res);
+      if (err) throw err;
+    } catch (err) {
+      rethrowApiError(err);
+    }
     return { settings, message: 'Settings saved.' };
   },
 
```

----- DIFF: server.ts, package.json, .gitignore -----
```diff
diff --git a/.gitignore b/.gitignore
index 3456257..07e135f 100644
--- a/.gitignore
+++ b/.gitignore
@@ -7,3 +7,5 @@ coverage/
 .env*
 !.env.example
 *.tar.gz
+test-results/
+playwright-report/
diff --git a/package.json b/package.json
index db52866..e4059c3 100644
--- a/package.json
+++ b/package.json
@@ -9,29 +9,31 @@
     "start": "node server.ts",
     "preview": "vite preview",
     "clean": "rm -rf dist server.js",
-    "lint": "tsc --noEmit"
+    "lint": "tsc --noEmit",
+    "test:e2e": "playwright test"
   },
   "dependencies": {
     "@google/genai": "^2.4.0",
     "@tailwindcss/vite": "^4.3.3",
     "@vitejs/plugin-react": "^6.1.1",
+    "dotenv": "^17.2.3",
+    "express": "^4.21.2",
     "lucide-react": "^0.546.0",
+    "motion": "^12.23.24",
     "react": "^19.0.1",
     "react-dom": "^19.0.1",
-    "vite": "^8.3.0",
-    "express": "^4.21.2",
-    "dotenv": "^17.2.3",
-    "motion": "^12.23.24"
+    "vite": "^8.3.0"
   },
   "devDependencies": {
+    "@playwright/test": "^1.64.0",
+    "@types/express": "^4.17.21",
     "@types/node": "^22.14.0",
     "@types/react": "^19.3.0",
     "@types/react-dom": "^19.3.0",
     "autoprefixer": "^10.4.21",
-    "esbuild": "^0.25.0",
+    "esbuild": "^0.28.0",
     "tailwindcss": "^4.3.3",
     "tsx": "^4.21.0",
-    "typescript": "^7.0.2",
-    "@types/express": "^4.17.21"
+    "typescript": "^7.0.2"
   }
 }
diff --git a/server.ts b/server.ts
index e24192b..4cfb9b0 100644
--- a/server.ts
+++ b/server.ts
@@ -13,7 +13,7 @@ const __filename = fileURLToPath(import.meta.url);
 const __dirname = path.dirname(__filename);
 
 const app = express();
-const PORT = 3000;
+const PORT = Number(process.env.PORT) || 3000;
 const isProduction = process.env.NODE_ENV === 'production';
 
 app.use(express.json({ limit: '15mb' }));
```

----- FULL FILE: src/services/api.ts -----
```ts
import { ClassSession, YogaClass, Booking, ContactMessage, AdminStats, ChatMessage } from '../types';

const FALLBACK_CLASSES: YogaClass[] = [
  {
    id: 'hatha',
    name: 'Hatha Yoga',
    level: 'All levels',
    duration: 60,
    style: 'hatha',
    description: 'The classical root of the practice — foundational postures, precise alignment, and the relationship between breath and movement. No experience necessary.',
  },
  {
    id: 'barre',
    name: 'Barre Yoga',
    level: 'All levels',
    duration: 60,
    style: 'barre',
    description: 'Strength work woven with deep, intentional stretching. Small controlled movements build heat and tone, then long holds open everything back up.',
  },
  {
    id: 'wheel',
    name: 'Wheel Yoga',
    level: 'All levels',
    duration: 75,
    style: 'wheel',
    description: "Priyanshi's signature class. The yoga wheel supports the spine through backbends and chest openers that feel impossible without it — then suddenly don't.",
  },
  {
    id: 'chakra',
    name: 'Chakra Yoga Flow',
    level: 'All levels',
    duration: 60,
    style: 'chakra',
    description: 'Energetic alignment sequencing from root to crown. Integrates breath, sound resonance, and movement to release physical blocks.',
  },
];

function generateFallbackSchedule(): ClassSession[] {
  const sessions: ClassSession[] = [];
  const now = new Date();
  const template: Record<number, { timeStr: string; hour: number; minute: number; classId: string; capacity: number } | null> = {
    1: { timeStr: '7:00 AM', hour: 7, minute: 0, classId: 'barre', capacity: 12 },
    2: { timeStr: '6:00 PM', hour: 18, minute: 0, classId: 'hatha', capacity: 12 },
    3: { timeStr: '7:00 AM', hour: 7, minute: 0, classId: 'barre', capacity: 12 },
    4: { timeStr: '6:00 PM', hour: 18, minute: 0, classId: 'wheel', capacity: 10 },
    5: null,
    6: { timeStr: '9:00 AM', hour: 9, minute: 0, classId: 'chakra', capacity: 15 },
    0: { timeStr: '10:00 AM', hour: 10, minute: 0, classId: 'hatha', capacity: 12 },
  };

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dubaiNow = new Date(now.getTime() + 4 * 60 * 60 * 1000);

  for (let dayOffset = 0; dayOffset < 56; dayOffset++) {
    const targetDubai = new Date(dubaiNow.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const dayOfWeek = targetDubai.getUTCDay();
    const rule = template[dayOfWeek];
    const dayName = dayNames[dayOfWeek];
    const monthName = monthNames[targetDubai.getUTCMonth()];
    const dayOfMonth = targetDubai.getUTCDate();
    const dateDubai = `${dayName}, ${monthName} ${dayOfMonth}`;

    if (!rule) {
      sessions.push({
        id: `sess-rest-${targetDubai.getTime()}`,
        classId: 'rest',
        className: 'Studio Rest & Integration Day',
        style: 'hatha',
        level: 'Rest',
        duration: 0,
        startTimeUtc: new Date(targetDubai.getTime() - 4 * 60 * 60 * 1000).toISOString(),
        dateDubai,
        timeDubai: 'All Day',
        capacity: 0,
        bookedCount: 0,
        spotsLeft: 0,
        status: 'available',
        isRestDay: true,
      });
      continue;
    }

    const classDef = FALLBACK_CLASSES.find((c) => c.id === rule.classId) || FALLBACK_CLASSES[0];
    const sessionDubaiTime = new Date(
      Date.UTC(
        targetDubai.getUTCFullYear(),
        targetDubai.getUTCMonth(),
        targetDubai.getUTCDate(),
        rule.hour,
        rule.minute,
        0
      )
    );
    const sessionUtcTime = new Date(sessionDubaiTime.getTime() - 4 * 60 * 60 * 1000);
    const isPast = sessionUtcTime.getTime() <= now.getTime();
    const pseudoBooked = (dayOffset * 3 + rule.hour) % 5;
    const bookedCount = isPast ? rule.capacity : Math.min(rule.capacity, pseudoBooked);
    const spotsLeft = Math.max(0, rule.capacity - bookedCount);

    sessions.push({
      id: `sess-${rule.classId}-${sessionDubaiTime.getTime()}`,
      classId: rule.classId,
      className: classDef.name,
      style: classDef.style,
      level: classDef.level,
      duration: classDef.duration,
      startTimeUtc: sessionUtcTime.toISOString(),
      dateDubai,
      timeDubai: rule.timeStr,
      capacity: rule.capacity,
      bookedCount,
      spotsLeft,
      status: isPast ? 'past' : spotsLeft === 0 ? 'full' : 'available',
      isRestDay: false,
    });
  }
  return sessions;
}

// Errors the server deliberately returned (validation, auth, lockout) must reach the UI.
// The local fallbacks below only apply when the API is unreachable or answers without one.
class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function serverError(res: Response): Promise<ApiError | null> {
  if (res.ok) return null;
  try {
    const data = await res.json();
    if (data?.error) return new ApiError(data.error, res.status);
  } catch {}
  return null;
}

function rethrowApiError(err: unknown) {
  if (err instanceof ApiError) throw err;
}

export const api = {
  async getClasses(): Promise<YogaClass[]> {
    try {
      const res = await fetch('/api/classes');
      if (!res.ok) throw new Error();
      const data = await res.json();
      return data.classes || FALLBACK_CLASSES;
    } catch {
      return FALLBACK_CLASSES;
    }
  },

  async getSchedule(): Promise<ClassSession[]> {
    try {
      const res = await fetch('/api/schedule');
      if (!res.ok) throw new Error();
      const data = await res.json();
      return data.sessions || generateFallbackSchedule();
    } catch {
      return generateFallbackSchedule();
    }
  },

  async createBooking(payload: {
    sessionId: string;
    fullName: string;
    email: string;
    mode: 'in_person' | 'online';
    planKey?: string;
    paymentMethod?: string;
  }): Promise<{
    booking: Booking;
    session: ClassSession;
    message: string;
    dispatchedEmails?: import('../types').EmailNotification[];
  }> {
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        return await res.json();
      }
      const err = await serverError(res);
      if (err) throw err;
    } catch (err) {
      rethrowApiError(err);
      // Fall through to resilient local handler
    }

    // Resilient fallback booking generator
    const schedule = generateFallbackSchedule();
    const session = schedule.find((s) => s.id === payload.sessionId) || schedule[0];
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const bookingToken = `YP-${randomSuffix}`;
    const isFree = payload.planKey === 'free' || !payload.planKey;
    const amountAed = isFree ? 0 : payload.planKey === 'single' ? 350 : payload.planKey === 'pack10' ? 3000 : 5600;

    const booking: Booking = {
      id: `book-${Date.now()}-${randomSuffix}`,
      bookingToken,
      sessionId: session.id,
      sessionTitle: session.className,
      sessionTimeDubai: `${session.dateDubai} at ${session.timeDubai}`,
      customerEmail: payload.email.trim().toLowerCase(),
      customerName: payload.fullName.trim(),
      mode: payload.mode,
      planKey: (payload.planKey as any) || 'free',
      amountAed,
      paymentMethod: payload.paymentMethod || (isFree ? 'complimentary' : 'card'),
      paymentStatus: isFree ? 'free' : payload.paymentMethod === 'studio' ? 'pending_at_studio' : 'paid',
      status: 'confirmed',
      creditStatus: 'used',
      bookedAt: new Date().toISOString(),
    };

    // Save to localStorage for manage-booking lookup
    try {
      const stored = JSON.parse(localStorage.getItem('yp_local_bookings') || '[]');
      stored.unshift(booking);
      localStorage.setItem('yp_local_bookings', JSON.stringify(stored));
    } catch {}

    const studentEmail: import('../types').EmailNotification = {
      id: `email-${Date.now()}-student`,
      recipient: booking.customerEmail,
      sender: 'Priyanshi <priyanshi@yogapriyanshi.com>',
      subject: 'Welcome to YogaPriyanshi — Your first step to a healthier, successful you!',
      body: `Hi ${booking.customerName}, this is Priyanshi!\n\nYour session is confirmed for ${booking.sessionTitle} on ${booking.sessionTimeDubai} at BurJuman Residence Block D, Dubai.\n\nBooking Reference: ${booking.bookingToken}\n\nSee you on the mat!`,
      type: 'student_confirmation',
      sentAt: new Date().toISOString(),
    };

    return {
      booking,
      session,
      message: "You're in. Booking confirmed!",
      dispatchedEmails: [studentEmail],
    };
  },

  async getRecentEmails(): Promise<import('../types').EmailNotification[]> {
    try {
      const res = await fetch('/api/emails/recent');
      if (res.ok) {
        const data = await res.json();
        return data.emails || [];
      }
    } catch {}
    return [];
  },

  async getBooking(token: string): Promise<{ booking: Booking; session: ClassSession }> {
    let notFound: ApiError | null = null;
    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(token)}`);
      if (res.ok) {
        return await res.json();
      }
      const err = await serverError(res);
      if (err && err.status !== 404) throw err;
      notFound = err;
    } catch (err) {
      rethrowApiError(err);
    }

    // Check localStorage fallback
    try {
      const stored: Booking[] = JSON.parse(localStorage.getItem('yp_local_bookings') || '[]');
      const found = stored.find((b) => b.bookingToken.toUpperCase() === token.toUpperCase().trim());
      if (found) {
        const schedule = generateFallbackSchedule();
        const session = schedule.find((s) => s.id === found.sessionId) || schedule[0];
        return { booking: found, session };
      }
    } catch {}

    throw notFound || new Error('No reservation found for this booking token.');
  },

  async cancelBooking(token: string): Promise<{ booking: Booking; message: string; noticeHours: number }> {
    try {
      const res = await fetch('/api/bookings/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingToken: token }),
      });
      if (res.ok) {
        return await res.json();
      }
      const err = await serverError(res);
      if (err && err.status !== 404) throw err;
    } catch (err) {
      rethrowApiError(err);
    }

    // Cancel in localStorage fallback
    try {
      const stored: Booking[] = JSON.parse(localStorage.getItem('yp_local_bookings') || '[]');
      const found = stored.find((b) => b.bookingToken.toUpperCase() === token.toUpperCase().trim());
      if (found) {
        found.status = 'cancelled';
        found.cancelledAt = new Date().toISOString();
        localStorage.setItem('yp_local_bookings', JSON.stringify(stored));
        return { booking: found, message: 'Reservation cancelled successfully.', noticeHours: 24 };
      }
    } catch {}

    throw new Error('Booking could not be cancelled.');
  },

  async sendContact(payload: {
    name: string;
    email: string;
    interest: string;
    message: string;
    website?: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) return await res.json();
      const err = await serverError(res);
      if (err) throw err;
    } catch (err) {
      rethrowApiError(err);
    }
    return { success: true, message: 'Thank you! Your message has been sent to Priyanshi.' };
  },

  async adminLogin(password: string): Promise<{ token: string; message: string }> {
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) return await res.json();
      const err = await serverError(res);
      if (err) throw err;
    } catch (err) {
      rethrowApiError(err);
    }
    if (password === 'Priyanshi2026!') {
      return { token: 'admin_session_token_' + Date.now(), message: 'Logged in successfully.' };
    }
    throw new Error('Invalid studio credentials.');
  },

  async getAdminStats(token: string): Promise<AdminStats & { upcomingSessions: ClassSession[]; recentMessages: ContactMessage[]; bookings: Booking[] }> {
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) return await res.json();
      const err = await serverError(res);
      if (err) throw err;
    } catch (err) {
      rethrowApiError(err);
    }
    const schedule = generateFallbackSchedule();
    const stored: Booking[] = JSON.parse(localStorage.getItem('yp_local_bookings') || '[]');
    return {
      totalRevenueAed: 18400,
      totalClients: 42,
      newClientsThisMonth: 8,
      upcomingBookingsCount: stored.length,
      earnings6Months: [
        { month: 'May', amountAed: 12400 },
        { month: 'Jun', amountAed: 14800 },
        { month: 'Jul', amountAed: 16200 },
        { month: 'Aug', amountAed: 17500 },
        { month: 'Sep', amountAed: 19100 },
        { month: 'Oct', amountAed: 18400 },
      ],
      googleDriveLink: 'https://drive.google.com/drive/folders/1YogaPriyanshi-Dubai-ClassSchedules',
      notificationEmail: 'nbsingh2050@gmail.com',
      recentMessages: [],
      upcomingSessions: schedule.slice(0, 10),
      bookings: stored,
    };
  },

  async updateAdminSettings(
    token: string,
    settings: { googleDriveLink?: string; notificationEmail?: string }
  ): Promise<{ settings: any; message: string }> {
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings),
      });
      if (res.ok) return await res.json();
      const err = await serverError(res);
      if (err) throw err;
    } catch (err) {
      rethrowApiError(err);
    }
    return { settings, message: 'Settings saved.' };
  },

  async askMathTutor(payload: {
    messages: { role: string; content: string }[];
    currentPrompt?: string;
    imageBase64?: string;
    mimeType?: string;
  }): Promise<{ reply: string; modelUsed: string }> {
    try {
      const res = await fetch('/api/gemini/math-tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) return await res.json();
    } catch {}
    return {
      reply: "Let's examine that together! In mathematics, what is the main operation or relationship you notice first?",
      modelUsed: 'gemini-socratic-fallthrough',
    };
  },
};
```

----- FULL FILE: playwright.config.ts -----
```ts
import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

export default defineConfig({
  testDir: './e2e',
  // The server keeps all data in memory, so specs run one at a time against a
  // fresh server each run (admin lockout and free-class state would otherwise leak).
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    screenshot: 'on',
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: 'npx tsx server.ts',
    url: `http://localhost:${PORT}/api/classes`,
    env: { PORT: String(PORT) },
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
```

----- FULL FILE: e2e/helpers.ts -----
```ts
import { test as base, expect, Page, APIRequestContext } from '@playwright/test';
import path from 'path';

const SCREENSHOT_ROOT = path.join('test-results', 'screenshots');

/** Saves a numbered full-page screenshot under test-results/screenshots/<feature>/<test>/. */
export function stepShooter(page: Page, feature: string, testTitle: string) {
  let n = 0;
  const dir = path.join(SCREENSHOT_ROOT, feature, slug(testTitle));
  return async (step: string, opts: { fullPage?: boolean } = {}) => {
    n += 1;
    await page.waitForTimeout(250); // let transitions settle
    await page.screenshot({
      path: path.join(dir, `${String(n).padStart(2, '0')}-${slug(step)}.png`),
      fullPage: opts.fullPage ?? false,
    });
  };
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

export function uniqueEmail(tag: string) {
  return `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@example.com`;
}

/** Fails the test if the page logs console errors or uncaught exceptions. */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error' && !/Failed to load resource: the server responded with a status of 4\d\d/.test(msg.text()))
          errors.push(msg.text());
      });
      page.on('pageerror', (err) => errors.push(err.message));
      await use(errors);
      expect(errors, 'browser console errors').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export async function firstAvailableSession(request: APIRequestContext) {
  const res = await request.get('/api/schedule');
  const { sessions } = await res.json();
  const s = sessions.find((x: any) => !x.isRestDay && x.status === 'available');
  expect(s, 'an available session exists').toBeTruthy();
  return s;
}

export async function apiBook(request: APIRequestContext, overrides: Record<string, unknown> = {}) {
  const session = await firstAvailableSession(request);
  const res = await request.post('/api/bookings', {
    data: {
      sessionId: session.id,
      fullName: 'E2E Student',
      email: uniqueEmail('api'),
      mode: 'in_person',
      planKey: 'free',
      ...overrides,
    },
  });
  return { res, session, body: await res.json() };
}

export async function openHome(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

export const bookingModal = (page: Page) =>
  page.locator('div.fixed.inset-0').filter({ has: page.getByLabel('Close modal') });
```

----- FULL FILE: e2e/01-landing.spec.ts -----
```ts
import { test, expect, stepShooter, openHome, bookingModal } from './helpers';

const FEATURE = 'landing';

test('landing page renders every section with working images', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  const brokenImages: string[] = [];
  page.on('response', (r) => {
    if (r.request().resourceType() === 'image' && r.status() >= 400) brokenImages.push(r.url());
  });

  await openHome(page);
  await expect(page).toHaveTitle(/YogaPriyanshi/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Connect with your body');
  await shot('hero');

  for (const [id, heading] of [
    ['classes', 'Choose your practice'],
    ['about', "Hello, I'm Priyanshi."],
    ['schedule', 'Weekly schedule'],
    ['contact', 'Get in touch'],
  ] as const) {
    const section = page.locator(`#${id}`);
    await section.scrollIntoViewIfNeeded();
    await expect(section.getByRole('heading', { level: 2 })).toHaveText(heading);
    await shot(`section-${id}`);
  }
  await expect(page.getByRole('heading', { name: 'Four paths to stillness' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Voices from the mat' })).toBeVisible();

  // every <img> actually decoded
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForLoadState('networkidle');
  const undecoded = await page.$$eval('img', (imgs) =>
    imgs.filter((i) => !(i.complete && i.naturalWidth > 0)).map((i) => i.getAttribute('src'))
  );
  expect(undecoded, 'images that failed to load').toEqual([]);
  expect(brokenImages).toEqual([]);
  await shot('footer');
  await shot('full-page', { fullPage: true });
});

test('header navigation jumps to each section', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  const nav = page.locator('header nav');
  for (const name of ['Classes', 'Schedule', 'About', 'Contact']) {
    await nav.getByRole('link', { name, exact: true }).click();
    await expect(page.locator(`#${name.toLowerCase()}`)).toBeInViewport();
    await shot(`nav-${name}`);
  }
});

test('sticky book bar appears after scrolling and opens booking', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  const bar = page.getByLabel('Quick booking bar');
  await expect(bar).toHaveCount(0);
  await page.mouse.wheel(0, 1200);
  await expect(bar).toBeVisible();
  await shot('sticky-bar-visible');
  await bar.getByRole('button', { name: 'Book Now' }).click();
  await expect(bookingModal(page).getByText('Select practice')).toBeVisible();
  await shot('booking-opened');
});

test('"Book This Style" scrolls to the schedule', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  await page.getByRole('button', { name: 'Book This Style' }).first().click();
  await expect(page.locator('#schedule')).toBeInViewport();
  await shot('schedule-in-view');
});

test('pricing cards open booking with the matching package selected', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  await page.locator('#classes').scrollIntoViewIfNeeded();
  await shot('pricing');

  await page.locator('#classes').getByRole('button', { name: 'Claim Free Class' }).click();
  const modal = bookingModal(page);
  await expect(modal.getByText('Complimentary introductory class')).toBeVisible();
  await shot('free-plan-modal');
  await modal.getByLabel('Close modal').click();

  await page.locator('#classes').getByRole('button', { name: 'Get Started' }).first().click();
  await expect(modal.getByText('Flexible studio credits')).toBeVisible();
  await shot('paid-plan-modal');
});

test('schedule week tabs, session selection and "Book This Class"', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  const schedule = page.locator('#schedule');
  await schedule.scrollIntoViewIfNeeded();
  await expect(schedule.getByText('Retrieving live studio availability...')).toHaveCount(0);
  await expect(schedule.getByText('Rest Day')).toBeVisible();
  await shot('this-week');

  await schedule.getByRole('button', { name: 'Next Week' }).click();
  await shot('next-week');
  await schedule.getByRole('button', { name: 'Week 3' }).click();
  await shot('week-3');

  // pick a card with open spots and book it
  const card = schedule.getByText(/\d+ spots left/).first().locator('xpath=ancestor::*[contains(@class,"cursor-pointer") or @role="button" or self::button][1]');
  const target = (await card.count()) ? card : schedule.getByText(/\d+ spots left/).first();
  await target.click();
  const bookBtn = schedule.getByRole('button', { name: /Book This Class \(\d+ Left\)/ });
  await expect(bookBtn).toBeVisible();
  const detailTitle = await schedule.locator('h3').first().innerText();
  await shot('session-selected');

  await bookBtn.click();
  const modal = bookingModal(page);
  await expect(modal.locator('select')).toBeVisible();
  await expect(modal.locator('select option:checked')).toContainText(detailTitle);
  await shot('booking-preselected');
});
```

----- FULL FILE: e2e/02-booking.spec.ts -----
```ts
import { test, expect, stepShooter, openHome, bookingModal, uniqueEmail, apiBook } from './helpers';

const FEATURE = 'booking';

async function openBooking(page: import('@playwright/test').Page) {
  await openHome(page);
  await page.locator('header').getByRole('button', { name: 'Book Free Class' }).click();
  const modal = bookingModal(page);
  await expect(modal.getByText('Step 1 of 2')).toBeVisible();
  await expect(modal.locator('select option').first()).toBeAttached();
  return modal;
}

test('free first class: full happy path with validation', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  const email = uniqueEmail('free');
  const modal = await openBooking(page);
  await shot('step1-package-and-slot');

  await modal.getByRole('button', { name: 'Online Live Stream' }).click();
  await modal.getByRole('button', { name: /Continue to Checkout/ }).click();
  await expect(modal.getByText('Step 2 of 2')).toBeVisible();
  await shot('step2-details');

  await modal.getByRole('button', { name: 'Confirm Free Reservation' }).click();
  await expect(modal.getByText('Please provide your name and email address.')).toBeVisible();
  await shot('validation-empty');

  await modal.getByPlaceholder('e.g. Layla Al-Mansoor').fill('Test Student');
  await modal.getByPlaceholder('layla@example.com').fill('not-an-email');
  await modal.getByRole('button', { name: 'Confirm Free Reservation' }).click();
  await expect(modal.getByText('Please enter a valid email address.')).toBeVisible();
  await shot('validation-bad-email');

  await modal.getByPlaceholder('layla@example.com').fill(email);
  await modal.getByRole('button', { name: 'Confirm Free Reservation' }).click();
  await expect(modal.getByText("You're on the mat.")).toBeVisible();
  const token = await modal.locator('span.font-mono.text-2xl').innerText();
  expect(token).toMatch(/^YP-[0-9A-F]{6}$/);
  await expect(modal.getByText('Online Stream')).toBeVisible();
  await expect(modal.getByText('Complimentary', { exact: true })).toBeVisible();
  await shot('confirmation');

  await modal.getByRole('button', { name: 'View Email Copy' }).click();
  await expect(modal.getByText(`Your Booking Token: ${token}`)).toBeVisible();
  await shot('email-copy');

  // booking really persisted server-side
  const lookup = await page.request.get(`/api/bookings/${token}`);
  expect(lookup.status()).toBe(200);
  expect((await lookup.json()).booking.customerEmail).toBe(email);

  await modal.getByRole('button', { name: 'Return to Studio' }).click();
  await expect(modal).toHaveCount(0);
});

test('same email cannot claim the free class twice', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  const email = uniqueEmail('dupe');
  const first = await apiBook(page.request, { email });
  expect(first.res.status()).toBe(201);

  const modal = await openBooking(page);
  await modal.getByRole('button', { name: /Continue to Checkout/ }).click();
  await modal.getByPlaceholder('e.g. Layla Al-Mansoor').fill('Repeat Student');
  await modal.getByPlaceholder('layla@example.com').fill(email);
  await modal.getByRole('button', { name: 'Confirm Free Reservation' }).click();
  await expect(modal.getByText('This email has already used its free first class.', { exact: false })).toBeVisible();
  await expect(modal.getByText("You're on the mat.")).toHaveCount(0);
  await shot('duplicate-free-rejected');
});

test('paid single class, pay at studio', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  const modal = await openBooking(page);
  await modal.getByRole('button', { name: /AED 350/ }).click();
  await modal.getByRole('button', { name: /Continue to Checkout/ }).click();
  await modal.getByPlaceholder('e.g. Layla Al-Mansoor').fill('Studio Payer');
  await modal.getByPlaceholder('layla@example.com').fill(uniqueEmail('studio'));
  await modal.getByRole('button', { name: 'Pay at Studio' }).click();
  await expect(modal.getByText('Settle AED 350 at BurJuman')).toBeVisible();
  await shot('pay-at-studio-selected');
  await modal.getByRole('button', { name: 'Reserve Seat (Pay at Studio)' }).click();
  await expect(modal.getByText("You're on the mat.")).toBeVisible();
  await expect(modal.getByText('AED 350 (Pay at Studio)')).toBeVisible();
  await shot('confirmation');
});

test('paid 10-pack by card requires card details', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  const modal = await openBooking(page);
  await modal.getByRole('button', { name: /AED 3,000/ }).click();
  await modal.getByRole('button', { name: /Continue to Checkout/ }).click();
  await modal.getByPlaceholder('e.g. Layla Al-Mansoor').fill('Card Payer');
  await modal.getByPlaceholder('layla@example.com').fill(uniqueEmail('card'));
  await modal.getByRole('button', { name: /Pay AED 3,000 & Confirm/ }).click();
  await expect(modal.getByText('Please enter your card number')).toBeVisible();
  await shot('card-required');
  await modal.getByRole('button', { name: 'Use Test Card' }).click();
  await shot('test-card-filled');
  await modal.getByRole('button', { name: /Pay AED 3,000 & Confirm/ }).click();
  await expect(modal.getByText('AED 3000 (Paid)')).toBeVisible();
  await shot('confirmation');
});

test('bank transfer shows IBAN and books', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  const modal = await openBooking(page);
  await modal.getByRole('button', { name: /AED 5,600/ }).click();
  await modal.getByRole('button', { name: /Continue to Checkout/ }).click();
  await modal.getByPlaceholder('e.g. Layla Al-Mansoor').fill('Bank Payer');
  await modal.getByPlaceholder('layla@example.com').fill(uniqueEmail('bank'));
  await modal.getByRole('button', { name: 'Bank Transfer' }).click();
  await expect(modal.getByText(/IBAN: AE07/)).toBeVisible();
  await shot('bank-transfer');
  await modal.getByRole('button', { name: /Pay AED 5,600 & Confirm/ }).click();
  await expect(modal.getByText("You're on the mat.")).toBeVisible();
  await shot('confirmation');
});

test('back button returns to step 1 keeping choices', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  const modal = await openBooking(page);
  await modal.getByRole('button', { name: /AED 350/ }).click();
  await modal.getByRole('button', { name: /Continue to Checkout/ }).click();
  await modal.getByRole('button', { name: 'Back' }).click();
  await expect(modal.getByText('Step 1 of 2')).toBeVisible();
  await expect(modal.getByText('Flexible studio credits')).toBeVisible();
  await shot('back-to-step1');
});

test('booking API enforces capacity, double-booking and validation rules', async ({ request }) => {
  const email = uniqueEmail('rules');
  const { res, session, body } = await apiBook(request, { email, planKey: 'single' });
  expect(res.status()).toBe(201);
  expect(body.session.spotsLeft).toBe(session.spotsLeft - 1);

  const again = await request.post('/api/bookings', {
    data: { sessionId: session.id, fullName: 'X', email, mode: 'in_person', planKey: 'single' },
  });
  expect(again.status()).toBe(400);
  expect((await again.json()).error).toContain('already booked');

  const bad = await request.post('/api/bookings', {
    data: { sessionId: session.id, fullName: 'X', email: 'nope', mode: 'in_person' },
  });
  expect(bad.status()).toBe(400);

  const missing = await request.post('/api/bookings', { data: { sessionId: session.id } });
  expect(missing.status()).toBe(400);

  const { sessions } = await (await request.get('/api/schedule')).json();
  const rest = sessions.find((s: any) => s.isRestDay);
  const restRes = await request.post('/api/bookings', {
    data: { sessionId: rest.id, fullName: 'X', email: uniqueEmail('rest'), mode: 'in_person', planKey: 'single' },
  });
  expect(restRes.status()).toBe(400);

  const full = sessions.find((s: any) => !s.isRestDay && s.spotsLeft === 0 && s.status !== 'past');
  if (full) {
    const fullRes = await request.post('/api/bookings', {
      data: { sessionId: full.id, fullName: 'X', email: uniqueEmail('full'), mode: 'in_person', planKey: 'single' },
    });
    expect(fullRes.status()).toBe(400);
  }
});
```

----- FULL FILE: e2e/03-manage-booking.spec.ts -----
```ts
import { test, expect, stepShooter, openHome, apiBook } from './helpers';

const FEATURE = 'manage-booking';

const cancelModal = (page: import('@playwright/test').Page) =>
  page.locator('div.fixed.inset-0').filter({ hasText: 'Manage Reservation' });

test('look up and cancel a booking (≥6h notice refunds credit)', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  const { body, session } = await apiBook(page.request, { planKey: 'single' });
  const token: string = body.booking.bookingToken;
  const spotsAfterBooking = body.session.spotsLeft;

  await openHome(page);
  await page.locator('header').getByRole('button', { name: 'Manage Booking' }).click();
  const modal = cancelModal(page);
  await expect(modal).toBeVisible();
  await shot('lookup-form');

  await modal.getByPlaceholder('e.g. YP-8K2N9F').fill(token.toLowerCase());
  await modal.getByRole('button', { name: 'Find My Reservation' }).click();
  await expect(modal.getByText('E2E Student')).toBeVisible();
  await expect(modal.getByText('confirmed', { exact: true })).toBeVisible();
  await expect(modal.getByText('Eligible for Free Cancellation')).toBeVisible();
  await shot('booking-found');

  await modal.getByRole('button', { name: 'Confirm Cancellation' }).click();
  await expect(modal.getByText('Reservation Cancelled')).toBeVisible();
  await expect(modal.getByText('Refunded', { exact: true })).toBeVisible();
  await shot('cancelled');

  const { sessions } = await (await page.request.get('/api/schedule')).json();
  expect(sessions.find((s: any) => s.id === session.id).spotsLeft).toBe(spotsAfterBooking + 1);

  await modal.getByRole('button', { name: 'Done & Return to Studio' }).click();
  await page.locator('#schedule').getByRole('button', { name: 'Cancel / Manage Reservation' }).click();
  await modal.getByPlaceholder('e.g. YP-8K2N9F').fill(token);
  await modal.getByRole('button', { name: 'Find My Reservation' }).click();
  await expect(modal.getByText('This reservation has already been cancelled.')).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Confirm Cancellation' })).toHaveCount(0);
  await shot('already-cancelled');

  const again = await page.request.post('/api/bookings/cancel', { data: { bookingToken: token } });
  expect(again.status()).toBe(400);
});

test('unknown token shows a clear error', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  await page.getByRole('button', { name: 'Manage / Cancel Reservation →' }).click();
  const modal = cancelModal(page);
  await modal.getByPlaceholder('e.g. YP-8K2N9F').fill('YP-000000');
  await modal.getByRole('button', { name: 'Find My Reservation' }).click();
  await expect(modal.getByText(/No (booking|reservation) found/)).toBeVisible();
  await shot('not-found');

  await modal.getByRole('button').first().click(); // close (X)
  await expect(modal).toHaveCount(0);
});
```

----- FULL FILE: e2e/04-contact.spec.ts -----
```ts
import { test, expect, stepShooter, openHome, uniqueEmail } from './helpers';

const FEATURE = 'contact';

async function adminToken(request: import('@playwright/test').APIRequestContext) {
  const res = await request.post('/api/admin/login', { data: { password: 'Priyanshi2026!' } });
  expect(res.status()).toBe(200);
  return (await res.json()).token as string;
}

test('contact form sends a message that reaches the admin inbox', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  const email = uniqueEmail('contact');
  await openHome(page);
  const contact = page.locator('#contact');
  await contact.scrollIntoViewIfNeeded();
  await shot('empty-form');

  // browser-level required validation blocks empty submit
  await contact.getByRole('button', { name: 'Send Message' }).click();
  await expect(contact.getByText('Message Sent')).toHaveCount(0);

  await contact.getByPlaceholder('e.g. Sarah Jenkins').fill('Contact Tester');
  await contact.getByPlaceholder('sarah@example.com').fill(email);
  await contact.locator('select').selectOption('Wheel Yoga');
  await contact.getByPlaceholder(/Tell Priyanshi/).fill('Is the Wheel class OK for beginners?');
  await shot('filled-form');
  await contact.getByRole('button', { name: 'Send Message' }).click();
  await expect(contact.getByText('Message Sent')).toBeVisible();
  await shot('sent');

  const token = await adminToken(page.request);
  const stats = await (await page.request.get('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } })).json();
  const msg = stats.recentMessages.find((m: any) => m.email === email);
  expect(msg).toBeTruthy();
  expect(msg.interest).toBe('Wheel Yoga');

  await contact.getByRole('button', { name: 'Send Another Message' }).click();
  await expect(contact.getByPlaceholder('e.g. Sarah Jenkins')).toHaveValue('');
});

test('honeypot submissions are silently discarded', async ({ request }) => {
  const email = uniqueEmail('bot');
  const res = await request.post('/api/contact', {
    data: { name: 'Bot', email, message: 'spam', website: 'http://spam.example' },
  });
  expect(res.status()).toBe(200);
  const token = await adminToken(request);
  const stats = await (await request.get('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } })).json();
  expect(stats.recentMessages.find((m: any) => m.email === email)).toBeUndefined();
});

test('contact API rejects missing fields', async ({ request }) => {
  const res = await request.post('/api/contact', { data: { name: 'Only name' } });
  expect(res.status()).toBe(400);
});
```

----- FULL FILE: e2e/05-admin.spec.ts -----
```ts
import { test, expect, stepShooter, openHome, apiBook } from './helpers';

const FEATURE = 'admin';
const PASSWORD = 'Priyanshi2026!';

const adminModal = (page: import('@playwright/test').Page) =>
  page.locator('div.fixed.inset-0').filter({ hasText: /Instructor Portal|Studio Overview/ });

test('admin login, dashboard metrics, settings and logout', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await apiBook(page.request, { planKey: 'single' });

  await openHome(page);
  await page.locator('header').getByRole('button', { name: 'Admin' }).click();
  const modal = adminModal(page);
  await expect(modal.getByText('Instructor Portal')).toBeVisible();
  await shot('login');

  await modal.getByPlaceholder('Enter studio password...').fill('wrong-password');
  await modal.getByRole('button', { name: 'Sign In' }).click();
  await expect(modal.getByText(/Invalid admin password\. \(4 attempts remaining/)).toBeVisible();
  await shot('wrong-password');

  await modal.getByPlaceholder('Enter studio password...').fill(PASSWORD);
  await modal.getByRole('button', { name: 'Sign In' }).click();
  await expect(modal.getByText("Priyanshi's Studio Overview")).toBeVisible();
  await expect(modal.getByText('Total Revenue')).toBeVisible();
  await expect(modal.getByText('Earnings — Last 6 Months (AED)')).toBeVisible();
  await expect(modal.locator('table tbody tr')).toHaveCount(10);
  await expect(modal.getByText('Nour Al-Sabah')).toBeVisible();
  await shot('dashboard');
  await shot('dashboard-full', { fullPage: true });

  const upcoming = modal.getByText('Upcoming Bookings').locator('xpath=..');
  await expect(upcoming).not.toContainText(/^Upcoming Bookings\s*0/);

  const notify = modal.locator('input[type="email"]');
  await notify.fill('alerts@yogapriyanshi.com');
  await modal.getByRole('button', { name: 'Persist Settings' }).click();
  await expect(modal.getByText('Settings updated successfully.')).toBeVisible();
  await shot('settings-saved');

  // session survives a reload (token in localStorage) and settings persisted server-side
  await page.reload();
  await page.locator('header').getByRole('button', { name: 'Admin' }).click();
  await expect(modal.locator('input[type="email"]')).toHaveValue('alerts@yogapriyanshi.com');
  await shot('after-reload');

  await modal.getByRole('button', { name: 'Logout' }).click();
  await expect(modal.getByText('Instructor Portal')).toBeVisible();
  await shot('logged-out');
});

test('admin API rejects requests without a valid token', async ({ request }) => {
  expect((await request.get('/api/admin/stats')).status()).toBe(401);
  expect((await request.get('/api/admin/stats', { headers: { Authorization: 'Bearer bogus' } })).status()).toBe(401);
  expect((await request.post('/api/admin/settings', { data: { notificationEmail: 'x@y.z' } })).status()).toBe(401);
});

// Keep last: locks the admin portal for 15 minutes on this server instance.
test('admin portal locks after 5 failed attempts', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  await page.getByRole('button', { name: 'Admin Dashboard Portal' }).click();
  const modal = adminModal(page);
  for (let i = 0; i < 5; i++) {
    await modal.getByPlaceholder('Enter studio password...').fill(`bad-${i}`);
    await modal.getByRole('button', { name: 'Sign In' }).click();
    await expect(modal.getByRole('button', { name: 'Sign In' })).toBeEnabled();
  }
  await expect(modal.getByText(/locked for 15 minutes/)).toBeVisible();
  await shot('locked');

  await modal.getByPlaceholder('Enter studio password...').fill(PASSWORD);
  await modal.getByRole('button', { name: 'Sign In' }).click();
  await expect(modal.getByText(/locked for security/)).toBeVisible();
  await expect(modal.getByText("Priyanshi's Studio Overview")).toHaveCount(0);
  await shot('correct-password-still-locked');
});
```

----- FULL FILE: e2e/06-mobile.spec.ts -----
```ts
import { test, expect, stepShooter, openHome, bookingModal, uniqueEmail } from './helpers';

const FEATURE = 'mobile';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('mobile layout has no horizontal scroll and menu works', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  await shot('hero');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0);

  await page.getByLabel('Toggle Navigation Menu').click();
  await expect(page.getByRole('link', { name: 'Classes & Pricing' })).toBeVisible();
  await shot('menu-open');
  await page.getByRole('link', { name: 'Contact & Location' }).click();
  await expect(page.getByRole('link', { name: 'Classes & Pricing' })).toHaveCount(0);
  await expect(page.locator('#contact')).toBeInViewport();
  await shot('contact');

  await page.getByLabel('Toggle Navigation Menu').click();
  await page.getByRole('button', { name: 'Studio Admin Portal', exact: true }).click();
  await expect(page.getByText('Instructor Portal')).toBeVisible();
  await shot('admin-from-menu');
});

test('mobile free booking end to end', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  await page.getByRole('button', { name: /Book Free First Class/ }).click();
  const modal = bookingModal(page);
  await expect(modal.getByText('Step 1 of 2')).toBeVisible();
  await shot('step1');
  await modal.getByRole('button', { name: /Continue to Checkout/ }).click();
  await modal.getByPlaceholder('e.g. Layla Al-Mansoor').fill('Mobile Student');
  await modal.getByPlaceholder('layla@example.com').fill(uniqueEmail('mobile'));
  await shot('step2');
  await modal.getByRole('button', { name: 'Confirm Free Reservation' }).click();
  await expect(modal.getByText("You're on the mat.")).toBeVisible();
  await shot('confirmed');
});
```

When you are done, reply with: (1) your review verdict for each change, (2) any conflicts with your current copy, (3) the branch and commit you pushed.
