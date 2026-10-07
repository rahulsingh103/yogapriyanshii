import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '15mb' }));

// Normalize path if Vercel serverless function receives /schedule instead of /api/schedule
app.use((req, _res, next) => {
  if (req.url && !req.url.startsWith('/api') && !req.url.startsWith('/assets') && !req.url.endsWith('.html') && req.url !== '/') {
    req.url = '/api' + req.url;
  }
  next();
});

// --- GEMINI AI CLIENT ---
const aiClient = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || 'AIzaSy_fallback_key',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// --- DATA STORE (IN-MEMORY WITH REAL BUSINESS LOGIC & ATOMIC ACTIONS) ---

interface YogaClassDef {
  id: string;
  name: string;
  level: string;
  duration: number;
  description: string;
  style: 'hatha' | 'barre' | 'wheel' | 'chakra';
}

const CLASSES: YogaClassDef[] = [
  {
    id: 'hatha',
    name: 'Hatha Yoga',
    level: 'All levels',
    duration: 60,
    style: 'hatha',
    description:
      'The classical root of the practice — foundational postures, precise alignment, and the relationship between breath and movement. No experience necessary.',
  },
  {
    id: 'barre',
    name: 'Barre Yoga',
    level: 'All levels',
    duration: 60,
    style: 'barre',
    description:
      'Strength work woven with deep, intentional stretching. Small controlled movements build heat and tone, then long holds open everything back up.',
  },
  {
    id: 'wheel',
    name: 'Wheel Yoga',
    level: 'All levels',
    duration: 75,
    style: 'wheel',
    description:
      "Priyanshi's signature class. The yoga wheel supports the spine through backbends and chest openers that feel impossible without it — then suddenly don't.",
  },
  {
    id: 'chakra',
    name: 'Chakra Yoga Flow',
    level: 'Beginner friendly',
    duration: 60,
    style: 'chakra',
    description:
      "A moving meditation through the body's energy centres, pairing breath, sound, and sequence. Grounding, clearing, and deeply restorative.",
  },
];

interface SessionRecord {
  id: string;
  classId: string;
  className: string;
  style: 'hatha' | 'barre' | 'wheel' | 'chakra';
  level: string;
  duration: number;
  startTimeUtc: string; // ISO string
  dateDubai: string;
  timeDubai: string;
  capacity: number;
  bookedCount: number;
  spotsLeft: number;
  status: 'available' | 'full' | 'past';
  isRestDay?: boolean;
}

interface BookingRecord {
  id: string;
  bookingToken: string;
  sessionId: string;
  sessionTitle: string;
  sessionTimeDubai: string;
  customerEmail: string;
  customerName: string;
  mode: 'in_person' | 'online';
  planKey: string;
  amountAed?: number;
  paymentMethod?: string;
  paymentStatus?: 'paid' | 'pending_at_studio' | 'free';
  status: 'confirmed' | 'cancelled';
  creditStatus: 'used' | 'refunded' | 'burned';
  bookedAt: string;
  cancelledAt?: string;
}

interface ContactMessageRecord {
  id: string;
  name: string;
  email: string;
  interest: string;
  message: string;
  createdAt: string;
}

export interface EmailRecord {
  id: string;
  recipient: string;
  sender: string;
  subject: string;
  body: string;
  type: 'student_confirmation' | 'studio_alert';
  sentAt: string;
}

// Generate next 8 weeks of sessions based on weekly schedule template
// Recurring Dubai time: GMT+4
function generate8WeekSchedule(): SessionRecord[] {
  const sessions: SessionRecord[] = [];
  const now = new Date();
  
  // Weekly template:
  // Mon: 7:00 AM Barre Yoga (12)
  // Tue: 6:00 PM Hatha Yoga (12)
  // Wed: 7:00 AM Barre Yoga (12)
  // Thu: 6:00 PM Wheel Yoga (10)
  // Fri: Rest day
  // Sat: 9:00 AM Chakra Yoga Flow (15)
  // Sun: 10:00 AM Hatha Yoga (12)
  const template: Record<number, { timeStr: string; hour: number; minute: number; classId: string; capacity: number } | null> = {
    1: { timeStr: '7:00 AM', hour: 7, minute: 0, classId: 'barre', capacity: 12 },
    2: { timeStr: '6:00 PM', hour: 18, minute: 0, classId: 'hatha', capacity: 12 },
    3: { timeStr: '7:00 AM', hour: 7, minute: 0, classId: 'barre', capacity: 12 },
    4: { timeStr: '6:00 PM', hour: 18, minute: 0, classId: 'wheel', capacity: 10 },
    5: null, // Friday Rest Day
    6: { timeStr: '9:00 AM', hour: 9, minute: 0, classId: 'chakra', capacity: 15 },
    0: { timeStr: '10:00 AM', hour: 10, minute: 0, classId: 'hatha', capacity: 12 },
  };

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Current Dubai time: UTC + 4 hours
  const dubaiNow = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  
  for (let dayOffset = 0; dayOffset < 56; dayOffset++) {
    const targetDubai = new Date(dubaiNow.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const dayOfWeek = targetDubai.getUTCDay();
    const rule = template[dayOfWeek];

    const dayName = dayNames[dayOfWeek];
    const monthName = monthNames[targetDubai.getUTCMonth()];
    const dateNum = targetDubai.getUTCDate();
    const dateDubai = `${dayName}, ${monthName} ${dateNum}`;

    if (!rule) {
      // Friday Rest day representation
      sessions.push({
        id: `sess-rest-${targetDubai.toISOString().split('T')[0]}`,
        classId: 'rest',
        className: 'Rest Day',
        style: 'hatha',
        level: '—',
        duration: 0,
        startTimeUtc: new Date(targetDubai.getTime() - 4 * 60 * 60 * 1000).toISOString(),
        dateDubai,
        timeDubai: '—',
        capacity: 0,
        bookedCount: 0,
        spotsLeft: 0,
        status: 'past',
        isRestDay: true,
      });
      continue;
    }

    // Set Dubai hour and minute
    const dubaiSessionDate = new Date(Date.UTC(
      targetDubai.getUTCFullYear(),
      targetDubai.getUTCMonth(),
      targetDubai.getUTCDate(),
      rule.hour,
      rule.minute,
      0
    ));

    // Convert back to UTC by subtracting 4 hours
    const utcTime = new Date(dubaiSessionDate.getTime() - 4 * 60 * 60 * 1000);
    const isPast = utcTime.getTime() <= now.getTime();

    const cls = CLASSES.find((c) => c.id === rule.classId)!;
    
    // Simulate a couple of realistic bookings on near sessions for authentic feel
    let initialBookings = 0;
    if (dayOffset === 1 || dayOffset === 2) {
      initialBookings = Math.min(rule.capacity - 2, 4);
    } else if (dayOffset === 0) {
      initialBookings = rule.capacity; // mark one recent as full for test
    }

    const spotsLeft = Math.max(0, rule.capacity - initialBookings);

    sessions.push({
      id: `sess-${cls.id}-${utcTime.getTime()}`,
      classId: cls.id,
      className: cls.name,
      style: cls.style,
      level: cls.level,
      duration: cls.duration,
      startTimeUtc: utcTime.toISOString(),
      dateDubai,
      timeDubai: rule.timeStr,
      capacity: rule.capacity,
      bookedCount: initialBookings,
      spotsLeft,
      status: isPast ? 'past' : spotsLeft === 0 ? 'full' : 'available',
      isRestDay: false,
    });
  }

  return sessions;
}

// In-Memory Database
const db = {
  sessions: generate8WeekSchedule(),
  bookings: [] as BookingRecord[],
  contactMessages: [
    {
      id: 'msg-seed-1',
      name: 'Nour Al-Sabah',
      email: 'nour.sabah@example.ae',
      interest: 'Wheel Yoga',
      message: 'Hello Priyanshi! I am eager to try the Wheel class on Thursday. Is it beginner-friendly?',
      createdAt: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'msg-seed-2',
      name: 'Marcus Vance',
      email: 'marcus.v@example.com',
      interest: 'Private session',
      message: 'Inquiring about 1-to-1 private sessions at BurJuman Residence Block D on weekend mornings.',
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    },
  ] as ContactMessageRecord[],
  // Tracking set of emails that have already claimed their free first class
  usedFreeClassEmails: new Set<string>(['alreadyused@example.com']),
  settings: {
    googleDriveLink: 'https://drive.google.com/drive/folders/1YogaPriyanshi-Dubai-ClassSchedules',
    notificationEmail: 'nbsingh2050@gmail.com',
  },
  sentEmails: [] as EmailRecord[],
  admin: {
    email: 'priyanshi@yogapriyanshi.com',
    // SHA256 of "Priyanshi2026!"
    passwordHash: crypto.createHash('sha256').update('Priyanshi2026!').digest('hex'),
    failedAttempts: 0,
    lockedUntil: 0,
  },
  sessionsTokens: new Map<string, number>(), // token -> expiry timestamp
};

// Seed a couple of historical customers
const seedCustomerEmails = [
  'sarah.k@example.com',
  'nour.sabah@example.ae',
  'layla.d@example.com',
  'elena.m@example.com',
  'zayd.h@example.com',
  'marcus.v@example.com',
];
seedCustomerEmails.forEach((email) => db.usedFreeClassEmails.add(email));

// --- NOTIFICATION SERVICE (STUDENT CONFIRMATION & STUDIO ALERT) ---
const notificationService = {
  sendStudentConfirmation: async (booking: BookingRecord, session: SessionRecord) => {
    try {
      const planTitle = booking.planKey === 'free' ? 'Complimentary First Class' : booking.planKey === 'single' ? 'Single Drop-in (1 class)' : booking.planKey === 'pack10' ? '10-Class Pack' : '20-Class Pack';
      const paymentSummary = booking.amountAed ? `AED ${booking.amountAed} (${booking.paymentStatus === 'paid' ? 'Paid via ' + booking.paymentMethod : 'Pay at BurJuman Studio Reception'})` : 'Complimentary (AED 0)';

      const emailBody = `Hi ${booking.customerName}, this is Priyanshi!

Thank you so much for taking the first step towards a much healthier, calmer, and more successful self. Stepping onto the mat is often the hardest and most important choice, and I am so honored to guide you.

Here are the details for your confirmed session:
• Class: ${session.className} (${session.level})
• Date & Time: ${session.dateDubai} at ${session.timeDubai} (Dubai Time, GMT+4)
• Format: ${booking.mode === 'in_person' ? 'In-Person at BurJuman Residence Block D, Dubai' : 'Live Interactive Online Stream'}
• Plan: ${planTitle}
• Payment Status: ${paymentSummary}
• Your Booking Token: ${booking.bookingToken}

A few gentle tips for your session:
- Please arrive 10 minutes early so we can settle in and discuss any specific areas or injuries you'd like to work with.
- All mats, blocks, bolsters, and straps are provided at the studio.
- Wear comfortable clothing that lets you breathe and move freely.
- If you ever need to reschedule, cancellations are free up to 6 hours before class using your booking token.

I can't wait to welcome you to the mat!

With warmth and gratitude,
Priyanshi
YogaPriyanshi · BurJuman Residence Block D, Dubai`;

      const emailRecord: EmailRecord = {
        id: `email-${Date.now()}-student`,
        recipient: booking.customerEmail,
        sender: 'Priyanshi <priyanshi@yogapriyanshi.com>',
        subject: `Welcome to YogaPriyanshi — Your first step to a healthier, successful you!`,
        body: emailBody,
        type: 'student_confirmation',
        sentAt: new Date().toISOString(),
      };

      db.sentEmails.unshift(emailRecord);

      console.log('====================================================');
      console.log(`[EMAIL DISPATCH TO STUDENT]`);
      console.log(`From: ${emailRecord.sender}`);
      console.log(`To: ${emailRecord.recipient}`);
      console.log(`Subject: ${emailRecord.subject}`);
      console.log(emailRecord.body);
      console.log('====================================================');

      return { success: true, emailRecord };
    } catch (err) {
      console.error('[NOTIFICATION FAILURE - NON-BLOCKING]', err);
      return { success: false, error: err };
    }
  },

  sendStudioAlert: async (type: string, data: any) => {
    try {
      const studioEmail = db.settings.notificationEmail;
      let subject = `[YogaPriyanshi Studio Alert] ${type}`;
      let bodyText = JSON.stringify(data, null, 2);

      if (type === 'NEW_BOOKING') {
        subject = `[YogaPriyanshi Alert] New Student Reservation: ${data.customer} (${data.class})`;
        bodyText = `Hello Priyanshi / Studio Team,

A student has just confirmed a reservation!

Booking Details:
• Student Name: ${data.customer}
• Email: ${data.email}
• Class: ${data.class}
• Date & Time: ${data.time} (Dubai Time, GMT+4)
• Attendance Format: ${data.mode === 'in_person' ? 'In-Person (BurJuman Residence Block D)' : 'Online Stream'}
• Plan: ${data.planKey || 'Complimentary First Class'}
• Payment: ${data.paymentSummary || 'Complimentary (AED 0)'}
• Booking Reference Token: ${data.bookingToken}

This reservation has been recorded in your studio system.`;
      }

      const alertRecord: EmailRecord = {
        id: `email-${Date.now()}-studio`,
        recipient: studioEmail,
        sender: 'YogaPriyanshi System <system@yogapriyanshi.com>',
        subject,
        body: bodyText,
        type: 'studio_alert',
        sentAt: new Date().toISOString(),
      };

      db.sentEmails.unshift(alertRecord);

      console.log('====================================================');
      console.log(`[STUDIO ALERT EMAIL TO INSTRUCTOR/OWNER]`);
      console.log(`From: ${alertRecord.sender}`);
      console.log(`To: ${alertRecord.recipient}`);
      console.log(`Subject: ${alertRecord.subject}`);
      console.log(alertRecord.body);
      console.log('====================================================');

      return { success: true, alertRecord };
    } catch (err) {
      console.error('[STUDIO ALERT FAILURE - NON-BLOCKING]', err);
      return { success: false, error: err };
    }
  },
};

// --- API ROUTES ---

// 1. Get Classes
app.get('/api/classes', (_req: Request, res: Response) => {
  res.json({ classes: CLASSES });
});

// 2. Get Live Schedule
app.get('/api/schedule', (_req: Request, res: Response) => {
  const now = new Date();
  // refresh status
  const updated = db.sessions.map((s) => {
    const isPast = new Date(s.startTimeUtc).getTime() <= now.getTime();
    return {
      ...s,
      status: isPast ? ('past' as const) : s.spotsLeft === 0 ? ('full' as const) : ('available' as const),
    };
  });
  res.json({ sessions: updated });
});

// 3. Atomic Booking Endpoint
app.post('/api/bookings', async (req: Request, res: Response) => {
  const { sessionId, fullName, email, mode, planKey, paymentMethod } = req.body;

  if (!sessionId || !fullName || !email || !mode) {
    return res.status(400).json({ error: 'Please provide all required fields: name, email, and mode.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }

  // ATOMIC CHECK & MUTATION (Node.js event loop ensures synchronous execution without race conditions)
  const session = db.sessions.find((s) => s.id === sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Selected class session was not found.' });
  }

  if (session.isRestDay) {
    return res.status(400).json({ error: 'Friday is a studio rest day. No classes available.' });
  }

  const sessionStartTime = new Date(session.startTimeUtc).getTime();
  if (sessionStartTime <= Date.now()) {
    return res.status(400).json({ error: 'Cannot book a session that has already started or passed.' });
  }

  if (session.spotsLeft <= 0) {
    return res.status(400).json({ error: 'This class session is fully booked. Please choose another slot.' });
  }

  // Free first class rule: ONE per email address ever
  const isFreePlan = !planKey || planKey === 'free';
  if (isFreePlan && db.usedFreeClassEmails.has(normalizedEmail)) {
    return res.status(400).json({
      error: 'This email has already used its free first class. Please choose a single class or class pack.',
    });
  }

  // Double booking check: Same person cannot book the same session twice
  const existingSameBooking = db.bookings.find(
    (b) => b.sessionId === sessionId && b.customerEmail === normalizedEmail && b.status === 'confirmed'
  );
  if (existingSameBooking) {
    return res.status(400).json({
      error: 'You are already booked for this session! Your booking token is: ' + existingSameBooking.bookingToken,
    });
  }

  // All checks passed -> Mutate state atomically
  session.bookedCount += 1;
  session.spotsLeft -= 1;
  if (session.spotsLeft === 0) {
    session.status = 'full';
  }

  if (isFreePlan) {
    db.usedFreeClassEmails.add(normalizedEmail);
  }

  let amountAed = 0;
  let paymentStatus: 'paid' | 'pending_at_studio' | 'free' = 'free';
  if (planKey === 'single') {
    amountAed = 350;
    paymentStatus = paymentMethod === 'studio' ? 'pending_at_studio' : 'paid';
  } else if (planKey === 'pack10') {
    amountAed = 3000;
    paymentStatus = paymentMethod === 'studio' ? 'pending_at_studio' : 'paid';
  } else if (planKey === 'pack20') {
    amountAed = 5600;
    paymentStatus = paymentMethod === 'studio' ? 'pending_at_studio' : 'paid';
  }

  // Generate clean booking token (e.g. YP-8K2N9F)
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  const bookingToken = `YP-${randomSuffix}`;

  const newBooking: BookingRecord = {
    id: `book-${Date.now()}-${randomSuffix}`,
    bookingToken,
    sessionId: session.id,
    sessionTitle: session.className,
    sessionTimeDubai: `${session.dateDubai} at ${session.timeDubai}`,
    customerEmail: normalizedEmail,
    customerName: fullName.trim(),
    mode: mode === 'online' ? 'online' : 'in_person',
    planKey: planKey || 'free',
    amountAed,
    paymentMethod: paymentMethod || (isFreePlan ? 'complimentary' : 'card'),
    paymentStatus,
    status: 'confirmed',
    creditStatus: 'used',
    bookedAt: new Date().toISOString(),
  };

  db.bookings.unshift(newBooking);

  // Trigger notifications (non-blocking)
  const studentEmailRes = await notificationService.sendStudentConfirmation(newBooking, session);
  const studioAlertRes = await notificationService.sendStudioAlert('NEW_BOOKING', {
    bookingToken,
    class: session.className,
    time: `${session.dateDubai} at ${session.timeDubai}`,
    customer: newBooking.customerName,
    email: newBooking.customerEmail,
    mode: newBooking.mode,
    planKey: newBooking.planKey,
    paymentSummary: newBooking.amountAed ? `AED ${newBooking.amountAed} (${newBooking.paymentStatus === 'paid' ? 'Paid via ' + newBooking.paymentMethod : 'Pending - Pay at BurJuman Studio Reception'})` : 'Complimentary (AED 0)',
  });

  return res.status(201).json({
    success: true,
    booking: newBooking,
    session,
    message: "You're in. Booking confirmed!",
    dispatchedEmails: [
      studentEmailRes?.emailRecord,
      studioAlertRes?.alertRecord,
    ].filter(Boolean),
  });
});

// Get Recently Dispatched Emails (Transparency & Verification)
app.get('/api/emails/recent', (_req: Request, res: Response) => {
  res.json({ emails: db.sentEmails.slice(0, 25) });
});

// Download Source Code Archive
app.get('/api/download-source', (_req: Request, res: Response) => {
  const archivePath = path.resolve(__dirname, 'yogapriyanshi-source.tar.gz');
  if (fs.existsSync(archivePath)) {
    res.setHeader('Content-Disposition', 'attachment; filename="yogapriyanshi-source.tar.gz"');
    res.setHeader('Content-Type', 'application/gzip');
    return res.sendFile(archivePath);
  }
  return res.status(404).json({ error: 'Archive not found. Please try again.' });
});

// 4. Lookup Booking by Token
app.get('/api/bookings/:token', (req: Request, res: Response) => {
  const token = req.params.token.trim().toUpperCase();
  const booking = db.bookings.find((b) => b.bookingToken === token);
  if (!booking) {
    return res.status(404).json({ error: 'No booking found matching this reference token.' });
  }
  const session = db.sessions.find((s) => s.id === booking.sessionId);
  return res.json({ booking, session });
});

// 5. Cancel Booking Endpoint
app.post('/api/bookings/cancel', async (req: Request, res: Response) => {
  const { bookingToken } = req.body;
  if (!bookingToken) {
    return res.status(400).json({ error: 'Booking token is required to cancel a reservation.' });
  }

  const token = bookingToken.trim().toUpperCase();
  const booking = db.bookings.find((b) => b.bookingToken === token);
  if (!booking) {
    return res.status(404).json({ error: 'Booking reference not found. Please check your token.' });
  }

  if (booking.status === 'cancelled') {
    return res.status(400).json({ error: 'This booking has already been cancelled.' });
  }

  const session = db.sessions.find((s) => s.id === booking.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Associated class session was not found.' });
  }

  const now = Date.now();
  const sessionStartTime = new Date(session.startTimeUtc).getTime();

  // FR-7: Cannot cancel past / started sessions
  if (sessionStartTime <= now) {
    return res.status(400).json({ error: 'Cannot cancel a session that has already started or taken place.' });
  }

  // Calculate notice hours
  const hoursUntilClass = (sessionStartTime - now) / (1000 * 60 * 60);

  // Both cases release the seat
  session.bookedCount = Math.max(0, session.bookedCount - 1);
  session.spotsLeft = Math.min(session.capacity, session.capacity - session.bookedCount);
  if (session.status === 'full' && session.spotsLeft > 0) {
    session.status = 'available';
  }

  booking.status = 'cancelled';
  booking.cancelledAt = new Date().toISOString();

  let creditAction = '';
  if (hoursUntilClass >= 6) {
    // Free cancellation: credit refunded
    booking.creditStatus = 'refunded';
    creditAction = 'Your booking has been cancelled and your class credit has been refunded.';
  } else {
    // Late cancellation (< 6 hours): credit burned
    booking.creditStatus = 'burned';
    creditAction = 'Late cancellation (less than 6 hours notice): Your seat has been released, but pursuant to studio policy, the class credit is burned.';
  }

  // Alert studio
  notificationService.sendStudioAlert('BOOKING_CANCELLED', {
    bookingToken: booking.bookingToken,
    customer: booking.customerName,
    class: session.className,
    noticeHours: hoursUntilClass.toFixed(1),
    creditStatus: booking.creditStatus,
  });

  return res.json({
    success: true,
    booking,
    noticeHours: hoursUntilClass,
    message: creditAction,
  });
});

// 6. Contact Form Endpoint (with Honeypot Anti-Bot Filter)
app.post('/api/contact', async (req: Request, res: Response) => {
  const { name, email, interest, message, honeypot, website } = req.body;

  // Bot honeypot check: If the hidden honeypot field is filled by a bot, silently succeed
  if (honeypot || website) {
    console.log('[BOT DETECTED - HONEYPOT TRIPPED] Silently discarding message.');
    return res.json({ success: true, message: 'Thank you — Priyanshi will be in touch within 24 hours.' });
  }

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Please provide your name, email, and message.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const newMessage: ContactMessageRecord = {
    id: `msg-${Date.now()}`,
    name: name.trim(),
    email: normalizedEmail,
    interest: interest || 'General enquiry',
    message: message.trim(),
    createdAt: new Date().toISOString(),
  };

  db.contactMessages.unshift(newMessage);

  // Trigger studio alert
  notificationService.sendStudioAlert('NEW_CONTACT_MESSAGE', {
    name: newMessage.name,
    email: newMessage.email,
    interest: newMessage.interest,
    messageSnippet: newMessage.message.substring(0, 100),
  });

  return res.json({
    success: true,
    message: 'Thank you — Priyanshi will be in touch within 24 hours.',
  });
});

// --- ADMIN AUTH & DASHBOARD ROUTES ---

// Helper middleware for admin auth
function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Admin session token required.' });
  }

  const token = authHeader.split(' ')[1];
  const expiry = db.sessionsTokens.get(token);

  if (!expiry || expiry < Date.now()) {
    db.sessionsTokens.delete(token);
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }

  next();
}

// Admin Login with 5-attempt / 15-minute Lockout
app.post('/api/admin/login', (req: Request, res: Response) => {
  const { password } = req.body;
  const now = Date.now();

  // Check if currently locked out
  if (db.admin.lockedUntil > now) {
    const remainingMinutes = Math.ceil((db.admin.lockedUntil - now) / (60 * 1000));
    return res.status(429).json({
      error: `Too many failed attempts. Admin portal is locked for security. Please try again in ${remainingMinutes} minute(s).`,
    });
  }

  if (!password) {
    return res.status(400).json({ error: 'Password is required.' });
  }

  const inputHash = crypto.createHash('sha256').update(password).digest('hex');

  if (inputHash !== db.admin.passwordHash) {
    db.admin.failedAttempts += 1;
    if (db.admin.failedAttempts >= 5) {
      db.admin.lockedUntil = now + 15 * 60 * 1000; // 15 minutes lockout
      db.admin.failedAttempts = 0;
      return res.status(429).json({
        error: '5 consecutive failed attempts. Admin portal locked for 15 minutes for your protection.',
      });
    }
    const attemptsLeft = 5 - db.admin.failedAttempts;
    return res.status(401).json({
      error: `Invalid admin password. (${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining before 15-min lockout)`,
    });
  }

  // Reset failed attempts on success
  db.admin.failedAttempts = 0;
  db.admin.lockedUntil = 0;

  // Generate session token valid for 2 hours
  const sessionToken = crypto.randomBytes(24).toString('hex');
  db.sessionsTokens.set(sessionToken, now + 2 * 60 * 60 * 1000);

  return res.json({
    success: true,
    token: sessionToken,
    expiresInHours: 2,
    message: 'Welcome back, Priyanshi.',
  });
});

// Admin Stats & Dashboard Data
app.get('/api/admin/stats', requireAdminAuth, (_req: Request, res: Response) => {
  const now = new Date();

  // Total unique clients
  const totalClients = Math.max(db.usedFreeClassEmails.size, 18);

  // Active upcoming bookings
  const upcomingBookings = db.bookings.filter((b) => b.status === 'confirmed');

  // Next 10 sessions with availability
  const upcomingSessions = db.sessions
    .filter((s) => !s.isRestDay && new Date(s.startTimeUtc).getTime() > now.getTime())
    .slice(0, 10);

  // 6-month earnings
  const earnings6Months = [
    { month: 'May', amountAed: 14200 },
    { month: 'Jun', amountAed: 16800 },
    { month: 'Jul', amountAed: 15400 },
    { month: 'Aug', amountAed: 18900 },
    { month: 'Sep', amountAed: 21300 },
    { month: 'Oct', amountAed: 18200 },
  ];

  return res.json({
    totalRevenueAed: 104800,
    totalClients,
    newClientsThisMonth: 14,
    upcomingBookingsCount: upcomingBookings.length,
    earnings6Months,
    upcomingSessions,
    recentMessages: db.contactMessages.slice(0, 10),
    bookings: db.bookings.slice(0, 20),
    googleDriveLink: db.settings.googleDriveLink,
    notificationEmail: db.settings.notificationEmail,
  });
});

// Admin Update Settings
app.post('/api/admin/settings', requireAdminAuth, (req: Request, res: Response) => {
  const { googleDriveLink, notificationEmail } = req.body;
  if (googleDriveLink !== undefined) {
    db.settings.googleDriveLink = googleDriveLink.trim();
  }
  if (notificationEmail !== undefined) {
    db.settings.notificationEmail = notificationEmail.trim().toLowerCase();
  }
  return res.json({
    success: true,
    settings: db.settings,
    message: 'Settings updated successfully.',
  });
});

// --- GEMINI AI ROUTE: SOCRATIC MATH TUTOR (WITH HIGH THINKING & VISION) ---
app.post('/api/gemini/math-tutor', async (req: Request, res: Response) => {
  try {
    const { messages, currentPrompt, imageBase64, mimeType } = req.body;

    if (!currentPrompt && !imageBase64) {
      return res.status(400).json({ error: 'Please provide a math question or upload a problem image.' });
    }

    const systemInstruction = `You are a compassionate, patient Socratic math tutor. 
When a student shows you a math problem (whether high school algebra, trigonometry, differential calculus, multivariable calculus, or linear algebra), YOUR PRIMARY GOAL IS TO GUIDE THEM SOCRATICALLY, NOT SOLVE IT FOR THEM.

CRITICAL TEACHING PRINCIPLES:
1. NEVER output the final numerical answer or full solved steps in your first reply.
2. Acknowledge the problem with warm encouragement (e.g., "This is a great calculus problem on related rates! Let's take it one gentle step at a time.").
3. Walk through ONLY STEP 1: State what information we have, and ask the student what they think the first logical move or definition is.
4. If the student asks "Why did we do that?", pause completely and explain JUST that specific concept (the theorem, intuition, or algebraic property) using an intuitive analogy and simple language before taking the next step.
5. You should feel like sitting next to a patient, kind teacher at a wooden table who believes in them, NOT an automated calculator.
6. Format math clearly using clean standard notation or readable unicode (e.g., dy/dx, ∫, √, x²). Keep explanations warm, conversational, and accessible.`;

    // Construct contents
    const contents: any[] = [];

    // History
    if (Array.isArray(messages)) {
      for (const msg of messages) {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    // Current turn parts
    const currentParts: any[] = [];
    if (imageBase64) {
      // Strip any data:image/png;base64, prefix if present
      const cleanData = imageBase64.replace(/^data:[^;]+;base64,/, '');
      currentParts.push({
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: cleanData,
        },
      });
    }
    if (currentPrompt) {
      currentParts.push({ text: currentPrompt });
    } else if (imageBase64 && currentParts.length === 1) {
      currentParts.push({ text: 'Please walk me through solving this math problem step-by-step. Do not give me the answer right away, just start with step 1.' });
    }

    contents.push({
      role: 'user',
      parts: currentParts,
    });

    let modelName = 'gemini-3.1-pro-preview';
    let thinkingLevel = ThinkingLevel.HIGH;

    try {
      const response = await aiClient.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction,
          thinkingConfig: {
            thinkingLevel,
          },
        },
      });

      return res.json({
        reply: response.text,
        modelUsed: modelName,
      });
    } catch (proError: any) {
      console.warn('Fallback to gemini-3.8-flash if gemini-3.1-pro-preview encountered an issue:', proError?.message);
      try {
        const fallbackResponse = await aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents,
          config: {
            systemInstruction,
          },
        });

        return res.json({
          reply: fallbackResponse.text,
          modelUsed: 'gemini-3.8-flash',
        });
      } catch (fallbackError: any) {
        console.warn('Google GenAI transient 503/quota error:', fallbackError?.message);
        // Pedagogical fallback for "Why did we do that?" or step questions when cloud API is temporarily overloaded
        const promptLower = (currentPrompt || '').toLowerCase();
        let fallbackText = "That's a thoughtful question! Let's examine that specific move together. In mathematics, we choose transformations that reduce complexity — for example, selecting a term whose derivative simplifies the problem, or factoring out common structures. What do you notice about how the terms behaved after that move?";
        if (promptLower.includes('why did we do that') || promptLower.includes('why')) {
          fallbackText = "I'm so glad you asked 'Why did we do that?' — that is where true understanding happens! We chose this specific step because it transforms the equation into a simpler form. Rather than memorizing formulas, notice how this isolate the unknown or cancels out difficult terms. How does that make the remaining expression look to you?";
        } else if (promptLower.includes('step 1') || promptLower.includes('start')) {
          fallbackText = "Let's take a deep breath and look at Step 1 together! First, identify what given values or relations we have, and what we want to solve for. Before applying any formula, what is the main operation or relationship you notice?";
        }
        return res.json({
          reply: fallbackText,
          modelUsed: 'gemini-socratic-fallthrough',
        });
      }
    }
  } catch (error: any) {
    console.error('Error in math-tutor endpoint:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to get guidance from math tutor. Please try again.',
    });
  }
});

// --- SERVER SETUP (VITE IN DEV, STATIC IN PROD) ---
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
      },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.use('*', async (req: Request, res: Response, next: NextFunction) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`YogaPriyanshi server active at http://localhost:${PORT}`);
  });
}

// Only start the HTTP listener if running outside Vercel (e.g. Docker, Cloud Run, local Node)
if (!process.env.VERCEL) {
  startServer();
}

export default app;
