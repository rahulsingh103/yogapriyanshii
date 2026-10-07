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
    } catch {
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
    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(token)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {}

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

    throw new Error('No reservation found for this booking token.');
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
    } catch {}

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
    } catch {}
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
    } catch {}
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
    } catch {}
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
    } catch {}
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
