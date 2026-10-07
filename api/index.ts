import express from 'express';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
app.use(express.json({ limit: '15mb' }));

// Gemini AI Client
const aiClient = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || 'AIzaSy_fallback_key',
  httpOptions: {
    headers: { 'User-Agent': 'aistudio-build' },
  },
});

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

interface SessionRecord {
  id: string;
  classId: string;
  className: string;
  style: 'hatha' | 'barre' | 'wheel' | 'chakra';
  level: string;
  duration: number;
  startTimeUtc: string;
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

function generate8WeekSchedule(): SessionRecord[] {
  const sessions: SessionRecord[] = [];
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

    const classDef = CLASSES.find((c) => c.id === rule.classId) || CLASSES[0];
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

const db = {
  sessions: generate8WeekSchedule(),
  bookings: [] as BookingRecord[],
  sentEmails: [] as any[],
};

// Route Normalization Middleware
app.use((req, _res, next) => {
  if (req.url && !req.url.startsWith('/api') && !req.url.startsWith('/assets') && !req.url.endsWith('.html') && req.url !== '/') {
    req.url = '/api' + req.url;
  }
  next();
});

// 1. Classes
app.get('/api/classes', (_req: Request, res: Response) => {
  res.json({ classes: CLASSES });
});

// 2. Schedule
app.get('/api/schedule', (_req: Request, res: Response) => {
  const now = new Date();
  const updated = db.sessions.map((s) => {
    const isPast = new Date(s.startTimeUtc).getTime() <= now.getTime();
    return {
      ...s,
      status: isPast ? ('past' as const) : s.spotsLeft === 0 ? ('full' as const) : ('available' as const),
    };
  });
  res.json({ sessions: updated });
});

// 3. Bookings
app.post('/api/bookings', (req: Request, res: Response) => {
  const { sessionId, fullName, email, mode, planKey, paymentMethod } = req.body;
  if (!sessionId || !fullName || !email || !mode) {
    return res.status(400).json({ error: 'Please provide all required fields: name, email, and mode.' });
  }

  const session = db.sessions.find((s) => s.id === sessionId);
  if (!session || session.isRestDay) {
    return res.status(404).json({ error: 'Selected class session was not found.' });
  }

  if (session.spotsLeft <= 0) {
    return res.status(400).json({ error: 'This class session is fully booked.' });
  }

  session.bookedCount += 1;
  session.spotsLeft = Math.max(0, session.capacity - session.bookedCount);
  if (session.spotsLeft === 0) session.status = 'full';

  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  const bookingToken = `YP-${randomSuffix}`;
  const isFree = planKey === 'free';
  const amountAed = isFree ? 0 : planKey === 'single' ? 350 : planKey === 'pack10' ? 3000 : 5600;

  const newBooking: BookingRecord = {
    id: `book-${Date.now()}-${randomSuffix}`,
    bookingToken,
    sessionId: session.id,
    sessionTitle: session.className,
    sessionTimeDubai: `${session.dateDubai} at ${session.timeDubai}`,
    customerEmail: email.trim().toLowerCase(),
    customerName: fullName.trim(),
    mode: mode === 'online' ? 'online' : 'in_person',
    planKey: planKey || 'free',
    amountAed,
    paymentMethod: paymentMethod || (isFree ? 'complimentary' : 'card'),
    paymentStatus: isFree ? 'free' : paymentMethod === 'studio' ? 'pending_at_studio' : 'paid',
    status: 'confirmed',
    creditStatus: 'used',
    bookedAt: new Date().toISOString(),
  };

  db.bookings.unshift(newBooking);

  res.status(201).json({
    success: true,
    booking: newBooking,
    session,
    message: "You're in. Booking confirmed!",
  });
});

// 4. Retrieve Booking
app.get('/api/bookings/:token', (req: Request, res: Response) => {
  const token = req.params.token.toUpperCase().trim();
  const booking = db.bookings.find((b) => b.bookingToken.toUpperCase() === token);
  if (!booking) {
    return res.status(404).json({ error: 'No reservation found for this booking token.' });
  }
  const session = db.sessions.find((s) => s.id === booking.sessionId);
  res.json({ booking, session });
});

// 5. Cancel Booking
app.post('/api/bookings/cancel', (req: Request, res: Response) => {
  const { bookingToken } = req.body;
  if (!bookingToken) return res.status(400).json({ error: 'Booking token is required.' });

  const token = bookingToken.toUpperCase().trim();
  const booking = db.bookings.find((b) => b.bookingToken.toUpperCase() === token);
  if (!booking) return res.status(404).json({ error: 'No reservation found for this token.' });
  if (booking.status === 'cancelled') return res.status(400).json({ error: 'This booking has already been cancelled.' });

  booking.status = 'cancelled';
  booking.cancelledAt = new Date().toISOString();

  const session = db.sessions.find((s) => s.id === booking.sessionId);
  if (session && session.bookedCount > 0) {
    session.bookedCount -= 1;
    session.spotsLeft = session.capacity - session.bookedCount;
    session.status = 'available';
  }

  res.json({ success: true, booking, message: 'Reservation cancelled successfully.', noticeHours: 24 });
});

export default app;
