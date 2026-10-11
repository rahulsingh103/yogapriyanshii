export type ClassStyle = 'hatha' | 'barre' | 'wheel' | 'chakra';

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
  style: ClassStyle;
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

export interface PricingPlan {
  key: string;
  title: string;
  priceText: string;
  priceAed: number;
  credits: number;
  validity: string;
  tag?: string;
  popular?: boolean;
  description: string;
  features: string[];
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
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
