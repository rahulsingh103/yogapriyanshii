import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useLenis } from 'lenis/react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { PracticeCarousel } from './components/PracticeCarousel';
import { AboutSection } from './components/AboutSection';
import { TestimonialsSection } from './components/TestimonialsSection';
import { CommunitySection } from './components/CommunitySection';
import { QuoteSection } from './components/QuoteSection';
import { HowItWorksSection } from './components/HowItWorksSection';
import { ScheduleSection } from './components/ScheduleSection';
import { PricingSection, type PlanKey } from './components/PricingSection';
import { FaqSection } from './components/FaqSection';
import { InstagramSection } from './components/InstagramSection';
import { FirstClassTrial } from './components/FirstClassTrial';
import { ContactSection } from './components/ContactSection';
import { ContactModal } from './components/ContactModal';
import { Footer } from './components/Footer';
import { PrivacyChoicesModal } from './components/PrivacyChoicesModal';
import { StickyBookBar } from './components/StickyBookBar';
import { BookingModal } from './components/BookingModal';
import { CancelModal } from './components/CancelModal';
import { MandalaBackground } from './components/MandalaBackground';
import { OfflineNotice } from './components/OfflineNotice';
import { WhatsAppChat } from './components/WhatsAppChat';
import { PageErrorBoundary, clearChunkReloadFlag, reloadOnceForChunkError } from './components/PageErrorBoundary';
import { WHATSAPP_ENABLED } from './constants/contact';
import { MEMBERSHIP } from './constants/membership';
import { useAccount } from './hooks/use-account';
import { useScrollToSection } from './hooks/use-smooth-scroll';
import { devPreviewSource, homeHistoryState, pageHistoryState, useRoute } from './hooks/use-route';
import { HOME_META, setDocumentHead } from './lib/page-meta';
import { CLASS_SLUGS, classPath } from './lib/route';
import type { PracticeClass } from './constants/classes';
import type { FinderChoice } from './constants/class-finder';
import type { AccountView, ClassSession, ClassStyle } from './types';

// The class pages and the 404 are their own chunks, so none of their copy is in the homepage bundle.
const ClassPage = lazy(() => import('./components/ClassPage').then((mod) => ({ default: mod.ClassPage })));
const NotFound = lazy(() => import('./components/NotFound').then((mod) => ({ default: mod.NotFound })));
// The guides: lazy too, and only routed once an article is published (src/content/articles.ts).
const ArticlePage = lazy(() => import('./components/ArticlePage').then((mod) => ({ default: mod.ArticlePage })));
const GuidesIndex = lazy(() => import('./components/GuidesIndex').then((mod) => ({ default: mod.GuidesIndex })));
// The class finder: one shared load, so a tap and the idle preload never fetch twice. A failed load
// is forgotten, so the next tap tries again; lazy() only ever renders after it has resolved.
let classFinderLoad: Promise<{ default: typeof import('./components/ClassFinderModal').ClassFinderModal }> | null = null;
let classFinderLoaded = false;
const loadClassFinder = () => {
  classFinderLoad ??= import('./components/ClassFinderModal').then(
    (mod) => {
      classFinderLoaded = true;
      return { default: mod.ClassFinderModal };
    },
    (error: unknown) => {
      classFinderLoad = null;
      throw error;
    }
  );
  return classFinderLoad;
};
const ClassFinderModal = lazy(loadClassFinder);
/** One shared load per chunk; a failed load is forgotten, so the next tap tries again. */
const sharedLoad = <T,>(load: () => Promise<T>) => {
  let p: Promise<T> | null = null;
  return () =>
    (p ??= load().catch((error: unknown) => {
      p = null;
      throw error;
    }));
};
// The account sheet and the admin dashboard: loaded on the first tap, so only their entry points are in
// the homepage bundle.
const loadAccountSheet = sharedLoad(() => import('./components/AccountModal').then((mod) => ({ default: mod.AccountModal })));
const AccountModal = lazy(loadAccountSheet);
const loadAdmin = sharedLoad(() => import('./components/AdminDashboard').then((mod) => ({ default: mod.AdminDashboard })));
const AdminDashboard = lazy(loadAdmin);
const LegalPage = lazy(() => import('./components/LegalPage').then((mod) => ({ default: mod.LegalPage })));
const UnsubscribePage = lazy(() => import('./components/UnsubscribePage').then((mod) => ({ default: mod.UnsubscribePage })));
// DEV ONLY (P7): in a build `import.meta.env.DEV` is false, so the preview and its import are dropped.
const DraftPreview = import.meta.env.DEV
  ? lazy(() => import('./components/DraftPreview').then((mod) => ({ default: mod.DraftPreview })))
  : null;

/** Data saver or 2G: the quiz chunk waits for a tap instead of using the student's data at idle. */
const onSlowOrSavingConnection = () => {
  const connection = (window.navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
    .connection;
  return connection?.saveData === true || connection?.effectiveType?.endsWith('2g') === true;
};

/** Runs after the next layout and paint: the page has swapped and Lenis can measure it. */
const afterLayout = (fn: () => void) => requestAnimationFrame(() => requestAnimationFrame(fn));

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
  const [privacyChoicesOpen, setPrivacyChoicesOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminMounted, setAdminMounted] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactInterest, setContactInterest] = useState<string | null>(null);
  const [classFinderOpen, setClassFinderOpen] = useState(false);
  // Rendered only after the first open, so a visitor who never opens it runs none of its code.
  const [classFinderMounted, setClassFinderMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountMounted, setAccountMounted] = useState(false);
  const [accountIntent, setAccountIntent] = useState<'signup' | 'login' | 'account'>('signup');
  const { account, checking: accountChecking, setAccount } = useAccount();
  const [booking, setBooking] = useState<BookingOpenState>({ session: null, style: null, planKey: 'free', mode: null });
  const scrollToSection = useScrollToSection();
  const lenis = useLenis();
  const { route, pathname, kind: navKind, key: navKey, navigate } = useRoute();
  const previewSource = devPreviewSource(pathname, route);
  const isHome = route.kind === 'home';
  // The navigation whose page has mounted (home at once; a lazy page once it calls onReady).
  const [readyKey, setReadyKey] = useState<number | null>(isHome ? 0 : null);
  const navKeyRef = useRef(navKey);
  navKeyRef.current = navKey;
  const markReady = useCallback(() => {
    // A page mounted, so the chunks load again: a later failure may use its one reload.
    clearChunkReloadFlag();
    setReadyKey(navKeyRef.current);
  }, []);
  // Home never calls markReady, so a finder chunk that loads shows the chunks work again and a later
  // failure may use its one reload. Only on home: a lazy page's own chunk may still be on its way, and
  // clearing the flag before it fails would let it reload for ever. Lazy pages clear through markReady.
  const isHomeRef = useRef(isHome);
  isHomeRef.current = isHome;
  const clearReloadFlagOnHome = () => {
    if (isHomeRef.current) clearChunkReloadFlag();
  };
  // The error message is on screen instead of the page: fade the preloader all the same.
  const markFailed = useCallback(() => setReadyKey(navKeyRef.current), []);
  // A quiz tap waiting for its chunk. Anything else that takes over the screen cancels it, even if it
  // has closed again by the time the chunk arrives, so the finder can't appear out of nowhere.
  const finderWaitRef = useRef<{ navKey: number } | null>(null);
  if (menuOpen || accountOpen || bookingModalOpen || cancelModalOpen || adminModalOpen || contactModalOpen) finderWaitRef.current = null;
  // A tap on Log in or Sign up waiting for its chunk, cancelled the same way.
  const accountWaitRef = useRef<object | null>(null);
  if (menuOpen || classFinderOpen || bookingModalOpen || cancelModalOpen || adminModalOpen || contactModalOpen) accountWaitRef.current = null;
  const adminWaitRef = useRef<object | null>(null);
  if (menuOpen || accountOpen || classFinderOpen || bookingModalOpen || cancelModalOpen || contactModalOpen) adminWaitRef.current = null;
  const accountChangedRef = useRef(false);
  /** Where to scroll once home has rendered after an in-app "go home" (Header, Footer, "All classes"). */
  const pendingSectionRef = useRef<string | null>(null);

  /** Instant: the page has just been swapped, so a long smooth scroll would only feel like lag. */
  const jumpTo = (target: HTMLElement | number) => {
    lenis?.resize();
    if (lenis) lenis.scrollTo(target, { immediate: true, force: true });
    else if (typeof target === 'number') window.scrollTo(0, target);
    else target.scrollIntoView({ block: 'start' });
  };

  /**
   * After an in-app "go home" from a page that has just unmounted: focus would otherwise fall to
   * <body>, so it moves to the section's heading (or the hero's h1), without scrolling again.
   */
  const focusHeading = (container: HTMLElement | null) => {
    const heading = container?.querySelector<HTMLElement>('h1, h2');
    if (!heading) return;
    if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  };

  /** Back on home: the carousel shows the card that was used, and its "Learn more" has focus again. */
  const restoreCard = (slug: string) => {
    // The slug comes from history.state, which any script on the page can write: only known slugs.
    if (!CLASS_SLUGS.includes(slug)) return false;
    const section = document.getElementById('classes');
    const item = section?.querySelector<HTMLElement>(`[data-card-slug="${slug}"]`);
    const track = item?.parentElement;
    if (!section || !item || !track) return false;
    jumpTo(section);
    const origin = track.getBoundingClientRect().left - track.scrollLeft + track.clientLeft;
    const max = track.scrollWidth - track.clientWidth;
    track.scrollLeft = Math.min(Math.max(Math.round(item.getBoundingClientRect().left - origin), 0), max);
    item.querySelector<HTMLAnchorElement>('a')?.focus({ preventScroll: true });
    return true;
  };

  // Arriving home in the app (Back, or a home link from another page): restore the head, then the place.
  useEffect(() => {
    if (!isHome) return;
    setReadyKey(navKey);
    if (navKind === 'initial') return;
    setDocumentHead(HOME_META);
    const section = pendingSectionRef.current;
    pendingSectionRef.current = null;
    const saved = navKind === 'pop' ? homeHistoryState() : null;
    afterLayout(() => {
      const el = section ? document.getElementById(section) : null;
      if (el) {
        jumpTo(el);
        return focusHeading(el);
      }
      if (saved?.cardSlug && restoreCard(saved.cardSlug)) return;
      jumpTo(saved?.y ?? 0);
      // A home link (no section) from a class page or the 404: the top of the page, focus on the hero.
      if (navKind === 'push') focusHeading(document.getElementById('home'));
    });
    // Once per navigation.
  }, [navKey]);

  const navigateHome = (sectionId?: string) => {
    pendingSectionRef.current = sectionId ?? null;
    navigate('/');
  };

  // "All classes": Back when the previous entry is our home page (it restores the card), otherwise a fresh visit.
  const handleAllClasses = () => {
    if (pageHistoryState()?.from === 'home') window.history.back();
    else navigateHome('classes');
  };

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

  // The open state is set only once the chunk is here. Until then the page stays live with no sheet,
  // so no failure can leave `classFinderOpen` true (it hides the floating WhatsApp button).
  const openClassFinder = () => {
    const showFinder = () => {
      setClassFinderMounted(true);
      setClassFinderOpen(true);
    };
    if (classFinderLoaded) return showFinder();
    const wait = { navKey: navKeyRef.current };
    finderWaitRef.current = wait;
    loadClassFinder().then(
      () => {
        clearReloadFlagOnHome();
        if (finderWaitRef.current !== wait) return;
        finderWaitRef.current = null;
        if (navKeyRef.current === wait.navKey) showFinder();
      },
      (error: unknown) => {
        if (finderWaitRef.current !== wait) return;
        finderWaitRef.current = null;
        reloadOnceForChunkError(error);
      }
    );
  };

  /** Shows a lazy sheet once its chunk is here, unless something else took over the screen meanwhile. */
  const openWhenLoaded = (load: () => Promise<unknown>, waitRef: { current: object | null }, show: () => void) => {
    finderWaitRef.current = null;
    const wait = {};
    waitRef.current = wait;
    const atNav = navKeyRef.current;
    load().then(
      () => {
        if (waitRef.current !== wait) return;
        waitRef.current = null;
        if (navKeyRef.current === atNav) show();
      },
      (error: unknown) => {
        if (waitRef.current !== wait) return;
        waitRef.current = null;
        reloadOnceForChunkError(error);
      }
    );
  };

  const openAccount = (intent: 'signup' | 'login' | 'account') => {
    accountChangedRef.current = false;
    openWhenLoaded(loadAccountSheet, accountWaitRef, () => {
      setAccountIntent(intent);
      setAccountMounted(true);
      setAccountOpen(true);
    });
  };

  const openAdmin = () =>
    openWhenLoaded(loadAdmin, adminWaitRef, () => {
      setAdminMounted(true);
      setAdminModalOpen(true);
    });

  // Logging in or out removes the button that opened the sheet, and below 1080px the opener was in the
  // closed menu: focus goes to Account or Log in on the bar, or to the menu toggle.
  const handOffFocus = (onlyIfLost = false) => {
    const narrow = !window.matchMedia('(min-width: 1080px)').matches;
    afterLayout(() => {
      // Closed before the reply came: only take focus back if it fell to the page.
      if (onlyIfLost && document.activeElement && document.activeElement !== document.body) return;
      document.querySelector<HTMLElement>(narrow ? '[data-menu-toggle]' : '[data-account-entry]')?.focus({ preventScroll: true });
    });
  };
  const accountOpenRef = useRef(accountOpen);
  accountOpenRef.current = accountOpen;
  const closeAccount = () => {
    setAccountOpen(false);
    if (accountChangedRef.current || !window.matchMedia('(min-width: 1080px)').matches) handOffFocus();
  };
  const changeAccount = (next: AccountView | null) => {
    accountChangedRef.current = true;
    setAccount(next);
    // The sheet was closed while the code was being checked: the hand-off happens now instead.
    if (!accountOpenRef.current) handOffFocus(true);
  };

  // Load the finder when the browser is idle, only on the pages that have a way to open it.
  const hasQuizEntry = isHome || route.kind === 'article' || !!previewSource;
  useEffect(() => {
    if (!hasQuizEntry) return;
    const preload = () => {
      if (window.navigator.onLine === false || onSlowOrSavingConnection()) return;
      loadClassFinder().then(clearReloadFlagOnHome, () => {}); // A tap tries again, and it handles the failure.
    };
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(preload, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(preload, 2000);
    return () => window.clearTimeout(id);
    // `isHome` too: arriving home from an article, an already loaded finder still clears the flag.
  }, [hasQuizEntry, isHome]);

  // Fade out the opening Buddha preloader (index.html) once the page has rendered: at once on home, and
  // only after the lazy page has mounted elsewhere (P3), so the static HTML never flashes away first.
  const pageReady = readyKey !== null;
  useEffect(() => {
    if (!pageReady) return;
    const el = document.getElementById('preloader');
    if (!el) return;
    const fade = window.setTimeout(() => el.classList.add('is-done'), 250);
    const remove = window.setTimeout(() => el.remove(), 900);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(remove);
    };
  }, [pageReady]);

  return (
    // Transparent on purpose: the page colour is on <body> so the mandala layer shows through.
    <div className="min-h-screen flex flex-col text-ink font-sans pb-[88px] sm:pb-0">
      <MandalaBackground />

      <Header
        account={account}
        accountChecking={accountChecking}
        onOpenAccount={openAccount}
        onOpenCancel={() => setCancelModalOpen(true)}
        onOpenAdmin={openAdmin}
        onMenuOpenChange={setMenuOpen}
        isHome={isHome}
        onNavigateHome={navigateHome}
      />

      {isHome ? (
      <main className="flex-1">
        <Hero onOpenBooking={() => handleOpenBooking()} onOpenClassFinder={openClassFinder} />
        <PracticeCarousel
          onSelectClass={handleSelectPractice}
          onOpenClassFinder={openClassFinder}
          onLearnMore={(practice) => navigate(classPath(practice.slug), { cardSlug: practice.slug })}
        />
        <AboutSection />
        <TestimonialsSection />
        <CommunitySection onSeeSchedule={() => scrollToSection('schedule')} />
        <QuoteSection />
        <HowItWorksSection />
        <ScheduleSection
          onSelectSession={(session) => handleOpenBooking({ session })}
          onOpenCancel={() => setCancelModalOpen(true)}
        />
        <PricingSection
          onOpenBooking={(planKey) => handleOpenBooking({ planKey })}
          onJoinMembership={() => handleOpenContact(MEMBERSHIP.interest)}
        />
        <FaqSection />
        <InstagramSection />
        <FirstClassTrial onPickTime={() => scrollToSection('schedule')} />
        <ContactSection onOpenContact={() => handleOpenContact()} />
        <StickyBookBar onOpenBooking={() => handleOpenBooking()} />
        <OfflineNotice />
      </main>
      ) : (
        <>
          {/* The shell (header, footer, WhatsApp and every modal) stays; only the page changes. */}
          {/* Keyed by navigation, so a failed page never sticks to the next one. */}
          <PageErrorBoundary key={navKey} onError={markFailed}>
          <Suspense fallback={<main className="flex-1" />}>
            {DraftPreview && previewSource ? (
              <DraftPreview
                source={previewSource}
                focusHeading={navKind !== 'initial'}
                onReady={markReady}
                onNavigateHome={navigateHome}
                missing={<NotFound onReady={markReady} onNavigateHome={navigateHome} />}
                onBook={() => handleOpenBooking()}
                onAsk={(interest) => handleOpenContact(interest)}
                onOpenQuiz={openClassFinder}
              />
            ) : route.kind === 'article' ? (
              <ArticlePage
                slug={route.slug}
                focusHeading={navKind !== 'initial'}
                onReady={markReady}
                onNavigate={navigate}
                onNavigateHome={navigateHome}
                missing={<NotFound onReady={markReady} onNavigateHome={navigateHome} />}
                onBook={() => handleOpenBooking()}
                onAsk={(interest) => handleOpenContact(interest)}
                onOpenQuiz={openClassFinder}
              />
            ) : route.kind === 'legal' ? (
              <LegalPage slug={route.slug} onReady={markReady} onNavigate={navigate} />
            ) : route.kind === 'unsubscribe' ? (
              <UnsubscribePage onReady={markReady} onNavigateHome={navigateHome} />
            ) : route.kind === 'guides' ? (
              <GuidesIndex focusHeading={navKind !== 'initial'} onReady={markReady} onNavigate={navigate} />
            ) : route.kind === 'class' ? (
              <ClassPage
                slug={route.slug}
                focusHeading={navKind !== 'initial'}
                onReady={markReady}
                onBook={(style) => handleOpenBooking({ style })}
                onContact={(interest) => handleOpenContact(interest)}
                onAllClasses={handleAllClasses}
              />
            ) : (
              <NotFound onReady={markReady} onNavigateHome={navigateHome} />
            )}
          </Suspense>
          </PageErrorBoundary>
          <OfflineNotice />
        </>
      )}

      <Footer
        onOpenCancel={() => setCancelModalOpen(true)}
        onOpenAdmin={openAdmin}
        onOpenBooking={() => handleOpenBooking()}
        onOpenClassFinder={openClassFinder}
        onOpenPrivacyChoices={() => setPrivacyChoicesOpen(true)}
        isHome={isHome}
        onNavigateHome={navigateHome}
        onNavigate={navigate}
      />

      {WHATSAPP_ENABLED && (
        <WhatsAppChat
          pageKey={readyKey}
          hidden={
            menuOpen || accountOpen || classFinderOpen || bookingModalOpen || cancelModalOpen || adminModalOpen || contactModalOpen || privacyChoicesOpen
          }
        />
      )}

      {/* Before Booking and Contact, so a sheet opened from the finder sits on top during its exit. */}
      {classFinderMounted && (
        // A render failure drops the finder completely, so the next tap starts clean and nothing stays hidden.
        <PageErrorBoundary
          fallback={null}
          onError={() => {
            setClassFinderOpen(false);
            setClassFinderMounted(false);
          }}
        >
          <Suspense fallback={null}>
            <ClassFinderModal isOpen={classFinderOpen} onClose={() => setClassFinderOpen(false)} onChoose={handleFinderChoice} />
          </Suspense>
        </PageErrorBoundary>
      )}

      {accountMounted && (
        // A render failure drops the sheet, like the finder: the next tap starts clean and nothing stays hidden.
        <PageErrorBoundary
          fallback={null}
          onError={() => {
            setAccountOpen(false);
            setAccountMounted(false);
          }}
        >
          <Suspense fallback={null}>
            <AccountModal
              isOpen={accountOpen}
              intent={accountIntent}
              account={account}
              onClose={closeAccount}
              onAccountChange={changeAccount}
            />
          </Suspense>
        </PageErrorBoundary>
      )}

      <BookingModal
        isOpen={bookingModalOpen}
        onClose={() => setBookingModalOpen(false)}
        preselectedSession={booking.session}
        preselectedStyle={booking.style}
        initialPlanKey={booking.planKey}
        initialMode={booking.mode}
      />

      <CancelModal isOpen={cancelModalOpen} onClose={() => setCancelModalOpen(false)} />
      <PrivacyChoicesModal isOpen={privacyChoicesOpen} onClose={() => setPrivacyChoicesOpen(false)} />

      {adminMounted && (
        <PageErrorBoundary
          fallback={null}
          onError={() => {
            setAdminModalOpen(false);
            setAdminMounted(false);
          }}
        >
          <Suspense fallback={null}>
            <AdminDashboard isOpen={adminModalOpen} onClose={() => setAdminModalOpen(false)} />
          </Suspense>
        </PageErrorBoundary>
      )}

      <ContactModal
        isOpen={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        initialInterest={contactInterest}
      />
    </div>
  );
}
