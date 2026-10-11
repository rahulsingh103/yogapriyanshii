import { useState } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { PracticeCarousel } from './components/PracticeCarousel';
import { AboutSection } from './components/AboutSection';
import { QuoteSection } from './components/QuoteSection';
import { ClassesPricing } from './components/ClassesPricing';
import { ScheduleSection } from './components/ScheduleSection';
import { ContactSection } from './components/ContactSection';
import { Footer } from './components/Footer';
import { StickyBookBar } from './components/StickyBookBar';
import { BookingModal } from './components/BookingModal';
import { CancelModal } from './components/CancelModal';
import { AdminDashboard } from './components/AdminDashboard';
import { MandalaBackground } from './components/MandalaBackground';
import { useScrollToSection } from './hooks/use-smooth-scroll';
import type { PracticeClass } from './constants/classes';
import type { ClassSession, ClassStyle } from './types';

type PlanKey = 'free' | 'single' | 'pack10' | 'pack20';

interface BookingOpenState {
  session: ClassSession | null;
  style: ClassStyle | null;
  planKey: PlanKey;
}

export default function App() {
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [booking, setBooking] = useState<BookingOpenState>({ session: null, style: null, planKey: 'free' });
  const scrollToSection = useScrollToSection();

  const handleOpenBooking = (opts: { session?: ClassSession; style?: ClassStyle; planKey?: PlanKey } = {}) => {
    setBooking({ session: opts.session ?? null, style: opts.style ?? null, planKey: opts.planKey ?? 'free' });
    setBookingModalOpen(true);
  };

  // Bookable classes open booking with their soonest session; the new ones aren't
  // on the timetable yet, so they go to Contact (a contact pop-up arrives in Batch 2).
  const handleSelectPractice = (practice: PracticeClass) => {
    if (practice.style) handleOpenBooking({ style: practice.style });
    else scrollToSection('contact');
  };

  return (
    // Transparent on purpose: the page colour is on <body> so the mandala layer shows through.
    <div className="min-h-screen flex flex-col text-ink font-sans">
      <MandalaBackground />

      <Header
        onOpenBooking={() => handleOpenBooking()}
        onOpenCancel={() => setCancelModalOpen(true)}
        onOpenAdmin={() => setAdminModalOpen(true)}
      />

      <main className="flex-1">
        <Hero onOpenBooking={() => handleOpenBooking()} />
        <PracticeCarousel onSelectClass={handleSelectPractice} />
        <AboutSection />
        <QuoteSection />
        <ClassesPricing
          onOpenBooking={(planKey) => handleOpenBooking({ planKey })}
          onOpenContact={() => scrollToSection('contact')}
        />
        <ScheduleSection
          onSelectSession={(session) => handleOpenBooking({ session })}
          onOpenCancel={() => setCancelModalOpen(true)}
        />
        <ContactSection />
        <StickyBookBar onOpenBooking={() => handleOpenBooking()} />
      </main>

      <Footer
        onOpenBooking={() => handleOpenBooking()}
        onOpenCancel={() => setCancelModalOpen(true)}
        onOpenAdmin={() => setAdminModalOpen(true)}
      />

      <BookingModal
        isOpen={bookingModalOpen}
        onClose={() => setBookingModalOpen(false)}
        preselectedSession={booking.session}
        preselectedStyle={booking.style}
        initialPlanKey={booking.planKey}
      />

      <CancelModal isOpen={cancelModalOpen} onClose={() => setCancelModalOpen(false)} />

      <AdminDashboard isOpen={adminModalOpen} onClose={() => setAdminModalOpen(false)} />
    </div>
  );
}
