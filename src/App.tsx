import { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { PracticeCarousel } from './components/PracticeCarousel';
import { AboutSection } from './components/AboutSection';
import { TestimonialsSection } from './components/TestimonialsSection';
import { QuoteSection } from './components/QuoteSection';
import { HowItWorksSection } from './components/HowItWorksSection';
import { ScheduleSection } from './components/ScheduleSection';
import { PricingSection, type PlanKey } from './components/PricingSection';
import { FaqSection } from './components/FaqSection';
import { InstagramSection } from './components/InstagramSection';
import { FirstClassFree } from './components/FirstClassFree';
import { ContactSection } from './components/ContactSection';
import { ContactModal } from './components/ContactModal';
import { ClassFinderModal } from './components/ClassFinderModal';
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
import type { FinderChoice } from './constants/class-finder';
import type { ClassSession, ClassStyle } from './types';

interface BookingOpenState {
  session: ClassSession | null;
  style: ClassStyle | null;
  planKey: PlanKey;
  /** Only the class finder sets it; null keeps the format the student picked last time. */
  mode: 'in_person' | 'online' | null;
}

export default function App() {
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactInterest, setContactInterest] = useState<string | null>(null);
  const [classFinderOpen, setClassFinderOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [booking, setBooking] = useState<BookingOpenState>({ session: null, style: null, planKey: 'free', mode: null });
  const scrollToSection = useScrollToSection();

  const handleOpenBooking = (
    opts: { session?: ClassSession; style?: ClassStyle; planKey?: PlanKey; mode?: 'in_person' | 'online' } = {}
  ) => {
    setBooking({
      session: opts.session ?? null,
      style: opts.style ?? null,
      planKey: opts.planKey ?? 'free',
      mode: opts.mode ?? null,
    });
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

  // The finder closes and the next sheet opens in the same update, so focus and `inert` pass straight
  // from one sheet to the other, and closing the second returns focus to the finder's entry link.
  const handleFinderChoice = (choice: FinderChoice) => {
    setClassFinderOpen(false);
    if (choice.kind === 'booking') handleOpenBooking({ style: choice.style, mode: choice.mode });
    else handleOpenContact(choice.interest);
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
        <Hero onOpenBooking={() => handleOpenBooking()} onOpenClassFinder={() => setClassFinderOpen(true)} />
        <PracticeCarousel onSelectClass={handleSelectPractice} onOpenClassFinder={() => setClassFinderOpen(true)} />
        <AboutSection />
        <TestimonialsSection />
        <QuoteSection />
        <HowItWorksSection />
        <ScheduleSection
          onSelectSession={(session) => handleOpenBooking({ session })}
          onOpenCancel={() => setCancelModalOpen(true)}
        />
        <PricingSection onOpenBooking={(planKey) => handleOpenBooking({ planKey })} />
        <FaqSection />
        <InstagramSection />
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
          hidden={
            menuOpen || classFinderOpen || bookingModalOpen || cancelModalOpen || adminModalOpen || contactModalOpen
          }
        />
      )}

      {/* Before Booking and Contact, so a sheet opened from the finder sits on top during its exit. */}
      <ClassFinderModal isOpen={classFinderOpen} onClose={() => setClassFinderOpen(false)} onChoose={handleFinderChoice} />

      <BookingModal
        isOpen={bookingModalOpen}
        onClose={() => setBookingModalOpen(false)}
        preselectedSession={booking.session}
        preselectedStyle={booking.style}
        initialPlanKey={booking.planKey}
        initialMode={booking.mode}
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
