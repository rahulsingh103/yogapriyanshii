import { ClassSession, YogaClass, Booking, ContactMessage, AdminStats, ChatMessage } from '../types';

export const api = {
  async getClasses(): Promise<YogaClass[]> {
    const res = await fetch('/api/classes');
    if (!res.ok) throw new Error('Failed to load classes.');
    const data = await res.json();
    return data.classes;
  },

  async getSchedule(): Promise<ClassSession[]> {
    const res = await fetch('/api/schedule');
    if (!res.ok) throw new Error('Failed to load schedule.');
    const data = await res.json();
    return data.sessions;
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
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to complete booking.');
    }
    return data;
  },

  async getRecentEmails(): Promise<import('../types').EmailNotification[]> {
    const res = await fetch('/api/emails/recent');
    if (!res.ok) throw new Error('Failed to load recent emails.');
    const data = await res.json();
    return data.emails || [];
  },

  async getBooking(token: string): Promise<{ booking: Booking; session: ClassSession }> {
    const res = await fetch(`/api/bookings/${encodeURIComponent(token)}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Booking reference not found.');
    }
    return data;
  },

  async cancelBooking(token: string): Promise<{ booking: Booking; message: string; noticeHours: number }> {
    const res = await fetch('/api/bookings/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingToken: token }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to cancel booking.');
    }
    return data;
  },

  async sendContact(payload: {
    name: string;
    email: string;
    interest: string;
    message: string;
    website?: string; // honeypot
  }): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to send message.');
    }
    return data;
  },

  async adminLogin(password: string): Promise<{ token: string; message: string }> {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login failed.');
    }
    return data;
  },

  async getAdminStats(token: string): Promise<AdminStats & { upcomingSessions: ClassSession[]; recentMessages: ContactMessage[]; bookings: Booking[] }> {
    const res = await fetch('/api/admin/stats', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to load dashboard.');
    }
    return data;
  },

  async updateAdminSettings(
    token: string,
    settings: { googleDriveLink?: string; notificationEmail?: string }
  ): Promise<{ settings: any; message: string }> {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update settings.');
    }
    return data;
  },

  async askMathTutor(payload: {
    messages: { role: string; content: string }[];
    currentPrompt?: string;
    imageBase64?: string;
    mimeType?: string;
  }): Promise<{ reply: string; modelUsed: string }> {
    const res = await fetch('/api/gemini/math-tutor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to get answer from tutor.');
    }
    return data;
  },
};
