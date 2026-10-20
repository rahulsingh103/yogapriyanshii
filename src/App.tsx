import { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { PracticeCarousel } from './components/PracticeCarousel';
import { AboutSection } from './components/AboutSection';
import { QuoteSection } from './components/QuoteSection';
import { ScheduleSection } from './components/ScheduleSection';
import { PricingSection, type PlanKey } from './components/PricingSection';
import { FaqSection } from './components/FaqSection';
import { FirstClassFree } from './components/FirstClassFree';
import { ContactSection } from './components/ContactSection';
import { ContactModal } from './components/ContactModal';
import { Footer } from './components/Footer';
import { StickyBookBar } from './components/StickyBookBar';
import { BookingModal } from './components/BookingModal';
import { CancelModal } from './components/CancelModal';
import { AdminDashboard } from './components/AdminDashboard';
import { MandalaBackground } from './components/MandalaBackground';
import { OfflineNotice } from './components/OfflineNotice';
import { WhatsAppChat } from './components/WhatsAppChat';
import { WHATSAPP_ENABLED } from './constants/contact';
import { useScrollToSection } from './hooks/use-smooth-scroll';
import type { PracticeClass } from './constants/classes';
import type { ClassSession, ClassStyle } from './types';

interface BookingOpenState {
  session: ClassSession | null;
  style: ClassStyle | null;
  planKey: PlanKey;
}

export default function App() {
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactInterest, setContactInterest] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [booking, setBooking] = useState<BookingOpenState>({ session: null, style: null, planKey: 'free' });
  const scrollToSection = useScrollToSection();

  const handleOpenBooking = (opts: { session?: ClassSession; style?: ClassStyle; planKey?: PlanKey } = {}) => {
    setBooking({ session: opts.session ?? null, style: opts.style ?? null, planKey: opts.planKey ?? 'free' });
    setBookingModalOpen(true);
  };

  const handleOpenContact = (interest: string | null = null) => {
    setContactInterest(interest);
    setContactModalOpen(true);
  };

  // Bookable classes open booking with their soonest session; the new ones aren't
  // on the timetable yet, so they open the contact pop-up with that class as the interest.
  const handleSelectPractice = (practice: PracticeClass) => {
    if (practice.style) handleOpenBooking({ style: practice.style });
    else handleOpenContact(practice.contactInterest ?? null);
  };

  // Fade out the opening Buddha preloader (index.html) once the app has rendered.
  useEffect(() => {
    const el = document.getElementById('preloader');
    if (!el) return;
    const fade = window.setTimeout(() => el.classList.add('is-done'), 250);
    const remove = window.setTimeout(() => el.remove(), 900);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(remove);
    };
  }, []);

  return (
    // Transparent on purpose: the page colour is on <body> so the mandala layer shows through.
    <div className="min-h-screen flex flex-col text-ink font-sans pb-[88px] sm:pb-0">
      <MandalaBackground />

      <Header
        onOpenBooking={() => handleOpenBooking()}
        onOpenCancel={() => setCancelModalOpen(true)}
        onOpenAdmin={() => setAdminModalOpen(true)}
        onMenuOpenChange={setMenuOpen}
      />

      <main className="flex-1">
        <Hero onOpenBooking={() => handleOpenBooking()} />
        <PracticeCarousel onSelectClass={handleSelectPractice} />
        <AboutSection />
        <QuoteSection />
        <ScheduleSection
          onSelectSession={(session) => handleOpenBooking({ session })}
          onOpenCancel={() => setCancelModalOpen(true)}
        />
        <PricingSection onOpenBooking={(planKey) => handleOpenBooking({ planKey })} />
        <FaqSection />
        <FirstClassFree onPickTime={() => scrollToSection('schedule')} />
        <ContactSection onOpenContact={() => handleOpenContact()} />
        <StickyBookBar onOpenBooking={() => handleOpenBooking()} />
        <OfflineNotice />
      </main>

      <Footer
        onOpenCancel={() => setCancelModalOpen(true)}
        onOpenAdmin={() => setAdminModalOpen(true)}
      />

      {WHATSAPP_ENABLED && (
        <WhatsAppChat
          hidden={menuOpen || bookingModalOpen || cancelModalOpen || adminModalOpen || contactModalOpen}
        />
      )}

      <BookingModal
        isOpen={bookingModalOpen}
        onClose={() => setBookingModalOpen(false)}
        preselectedSession={booking.session}
        preselectedStyle={booking.style}
        initialPlanKey={booking.planKey}
      />

      <CancelModal isOpen={cancelModalOpen} onClose={() => setCancelModalOpen(false)} />

      <AdminDashboard isOpen={adminModalOpen} onClose={() => setAdminModalOpen(false)} />

      <ContactModal
        isOpen={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        initialInterest={contactInterest}
      />
    </div>
  );
}
