export type ClassStyle = 'hatha' | 'barre' | 'chakra' | 'vinyasa' | 'yin';
/** A session's style can also be 'wheel': the retired class, on bookings made before it left the timetable. */
export type SessionStyle = ClassStyle | 'wheel';

export interface YogaClass {
  id: string;
  name: string;
  level: string;
  duration: number; // minutes
  description: string;
  style: ClassStyle;
  image?: string;
}

export interface ClassSession {
  id: string;
  classId: string;
  className: string;
  style: SessionStyle;
  level: string;
  duration: number;
  startTimeUtc: string; // ISO 8601
  dateDubai: string; // "Monday, Oct 5"
  timeDubai: string; // "7:00 AM"
  capacity: number;
  bookedCount: number;
  spotsLeft: number;
  status: 'available' | 'full' | 'past';
  isRestDay?: boolean;
}

export interface Customer {
  id: string;
  email: string; // normalized
  fullName: string;
  hasUsedFreeClass: boolean;
  createdAt: string;
}

export interface Booking {
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
  // Set by the server only. 'pending' = awaiting payment; 'paid' only after a verified payment.
  paymentStatus?: 'free' | 'pending' | 'pending_at_studio' | 'paid';
  status: 'confirmed' | 'cancelled';
  creditStatus: 'used' | 'refunded' | 'burned';
  bookedAt: string;
  cancelledAt?: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  /** Optional; null when the sender left it empty. */
  phone: string | null;
  interest: string;
  message: string;
  createdAt: string;
}

export interface AdminStats {
  totalRevenueAed: number;
  totalClients: number;
  newClientsThisMonth: number;
  upcomingBookingsCount: number;
  earnings6Months: {
    month: string;
    amountAed: number;
  }[];
  googleDriveLink: string;
  notificationEmail: string;
}

export interface EmailNotification {
  id: string;
  recipient: string;
  sender: string;
  subject: string;
  body: string;
  type: 'student_confirmation' | 'studio_alert';
  sentAt: string;
}

/** Monthly membership requests (admin Members tab). Status moves one step at a time on the server. */
export type MemberStatus = 'new' | 'contacted' | 'active';
export type MemberFormat = 'in_person' | 'online';

export interface MembershipRequest {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  planKey: string;
  planLabel: string;
  priceAed: number;
  format: MemberFormat | null;
  /** The optional "Preferred days and times"; '' when none was given. */
  preferredTimes: string;
  status: MemberStatus;
  /** YYYY-MM-DD, only while Active. */
  startDate: string | null;
  requestedAt: string;
  updatedAt: string;
}

export interface MembersPage {
  members: MembershipRequest[];
  page: number;
  pageSize: number;
  total: number;
  counts: Record<MemberStatus, number>;
}

/** A student's account (Log in, Sign up). Separate from bookings: nothing here is needed to book. */
export interface AccountView {
  email: string;
  offersOptIn: boolean;
}

/** One offer email as the admin sees it: counts only, never who it went to. */
export interface OfferSummary {
  id: string;
  subject: string;
  status: 'sending' | 'done';
  createdAt: string;
  finishedAt: string | null;
  sent: number;
  failed: number;
  skipped: number;
  /** Not sent yet, including any in flight. */
  remaining: number;
}

export interface OffersOverview {
  subscribers: number;
  current: OfferSummary | null;
  offers: OfferSummary[];
  /** The footer every offer email ends with. */
  footer: string;
}
