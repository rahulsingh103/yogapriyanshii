import React, { useState } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { FourPaths } from './components/FourPaths';
import { AboutSection } from './components/AboutSection';
import { ClassesPricing } from './components/ClassesPricing';
import { ScheduleSection } from './components/ScheduleSection';
import { TestimonialsAndGallery } from './components/TestimonialsAndGallery';
import { ContactSection } from './components/ContactSection';
import { Footer } from './components/Footer';
import { StickyBookBar } from './components/StickyBookBar';
import { BookingModal } from './components/BookingModal';
import { CancelModal } from './components/CancelModal';
import { AdminDashboard } from './components/AdminDashboard';
import { EmailInboxModal } from './components/EmailInboxModal';
import { SocraticMathTutor } from './components/SocraticMathTutor';
import { ClassSession } from './types';

export default function App() {
  const [activeView, setActiveView] = useState<'studio' | 'tutor'>('studio');
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [emailInboxOpen, setEmailInboxOpen] = useState(false);
  const [preselectedSession, setPreselectedSession] = useState<ClassSession | null>(null);

  const [selectedPlanKey, setSelectedPlanKey] = useState<'free' | 'single' | 'pack10' | 'pack20'>('free');

  const handleOpenBooking = (session?: ClassSession, planKey?: 'free' | 'single' | 'pack10' | 'pack20') => {
    if (session) {
      setPreselectedSession(session);
    } else {
      setPreselectedSession(null);
    }
    setSelectedPlanKey(planKey || 'free');
    setBookingModalOpen(true);
  };

  const handleSelectClassStyle = (_classId: string) => {
    // Scroll to schedule and open booking
    const scheduleElem = document.getElementById('schedule');
    if (scheduleElem) {
      scheduleElem.scrollIntoView({ behavior: 'smooth' });
    } else {
      handleOpenBooking();
    }
  };

  return (
    <div className="min-h-screen bg-[#faf8f3] text-[#0f0e0b] flex flex-col font-sans selection:bg-[#c4b48a]/35">
      {/* Global Header */}
      <Header
        onOpenBooking={() => handleOpenBooking()}
        onOpenCancel={() => setCancelModalOpen(true)}
        onOpenAdmin={() => setAdminModalOpen(true)}
        onOpenEmails={() => setEmailInboxOpen(true)}
        activeView={activeView}
        onSwitchView={(v) => {
          setActiveView(v);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* Main View: Yoga Studio or Socratic Math Tutor */}
      {activeView === 'studio' ? (
        <main className="flex-1">
          <Hero onOpenBooking={() => handleOpenBooking()} />
          <FourPaths onSelectClass={handleSelectClassStyle} />
          <AboutSection onOpenBooking={() => handleOpenBooking()} />
          <ClassesPricing
            onOpenBooking={(plan) => handleOpenBooking(undefined, plan)}
            onOpenContact={() => {
              const contactElem = document.getElementById('contact');
              contactElem?.scrollIntoView({ behavior: 'smooth' });
            }}
          />
          <ScheduleSection
            onSelectSession={(session) => handleOpenBooking(session)}
            onOpenCancel={() => setCancelModalOpen(true)}
          />
          <TestimonialsAndGallery onOpenBooking={() => handleOpenBooking()} />
          <ContactSection />
          <StickyBookBar onOpenBooking={() => handleOpenBooking()} />
        </main>
      ) : (
        <main className="flex-1">
          <SocraticMathTutor onBackToStudio={() => setActiveView('studio')} />
        </main>
      )}

      {/* Footer */}
      <Footer
        onOpenBooking={() => handleOpenBooking()}
        onOpenCancel={() => setCancelModalOpen(true)}
        onOpenAdmin={() => setAdminModalOpen(true)}
      />

      {/* Modals */}
      <BookingModal
        isOpen={bookingModalOpen}
        onClose={() => setBookingModalOpen(false)}
        preselectedSession={preselectedSession}
        initialPlanKey={selectedPlanKey}
      />

      <CancelModal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
      />

      <AdminDashboard
        isOpen={adminModalOpen}
        onClose={() => setAdminModalOpen(false)}
      />

      <EmailInboxModal
        isOpen={emailInboxOpen}
        onClose={() => setEmailInboxOpen(false)}
      />
    </div>
  );
}
