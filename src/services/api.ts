import { ClassSession, YogaClass, Booking, ContactMessage, AdminStats, EmailNotification } from '../types';

// Every failure surfaces as an ApiError with a human message. Nothing is ever faked locally:
// if the server didn't confirm it, the UI must not claim it happened.
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
  }
}

const NETWORK_ERROR =
  "We couldn't reach the studio's booking system. Please check your connection and try again, or contact Priyanshi directly.";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError(NETWORK_ERROR, 0);
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new ApiError(data?.error || NETWORK_ERROR, res.status, data?.code);
  }
  if (data === null) throw new ApiError(NETWORK_ERROR, res.status);
  return data as T;
}

const json = (body: unknown, token?: string): RequestInit => ({
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify(body),
});

export const api = {
  async getClasses(): Promise<YogaClass[]> {
    const data = await request<{ classes?: YogaClass[] }>('/api/classes');
    return data.classes || [];
  },

  async getSchedule(): Promise<ClassSession[]> {
    const data = await request<{ sessions?: ClassSession[] }>('/api/schedule');
    return data.sessions || [];
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
    dispatchedEmails?: EmailNotification[];
  }> {
    return request('/api/bookings', json(payload));
  },

  async getBooking(token: string): Promise<{ booking: Booking; session: ClassSession }> {
    return request(`/api/bookings/${encodeURIComponent(token)}`);
  },

  async cancelBooking(token: string): Promise<{ booking: Booking; message: string; noticeHours: number }> {
    return request('/api/bookings/cancel', json({ bookingToken: token }));
  },

  async sendContact(payload: {
    name: string;
    email: string;
    interest: string;
    message: string;
    website?: string;
  }): Promise<{ success: boolean; message: string }> {
    return request('/api/contact', json(payload));
  },

  async adminLogin(password: string): Promise<{ token: string; message: string }> {
    return request('/api/admin/login', json({ password }));
  },

  async adminLogout(token: string): Promise<void> {
    await request('/api/admin/logout', json({}, token));
  },

  async getAdminStats(
    token: string
  ): Promise<AdminStats & { upcomingSessions: ClassSession[]; recentMessages: ContactMessage[]; bookings: Booking[] }> {
    return request('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } });
  },

  async updateAdminSettings(
    token: string,
    settings: { googleDriveLink?: string; notificationEmail?: string }
  ): Promise<{ settings: { googleDriveLink: string; notificationEmail: string }; message: string }> {
    return request('/api/admin/settings', json(settings, token));
  },
};
