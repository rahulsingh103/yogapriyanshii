import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { m, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';
import { ui } from '@/lib/ui';
import { WHATSAPP_ENABLED, whatsappUrl } from '@/constants/contact';
import {
  FINDER_QUESTIONS,
  FINDER_REASONS,
  classFinderPrefill,
  finderClass,
  recommend,
  resultAction,
  resultLines,
  type FinderAnswers,
  type FinderChoice,
  type FinderQuestion,
} from '../constants/class-finder';
import {
  EMPTY_HEALTH,
  HEALTH_INTRO,
  HEALTH_MAX_CHARS,
  HEALTH_MEASURES,
  HEALTH_RESULT,
  HEALTH_TEXT_STEPS,
  ageOk,
  classFinderMessage,
  finderHasHealth,
  finderHasHealthNotes,
  heightOk,
  normaliseDigits,
  type FinderHealth,
  type HealthTextKey,
} from '../constants/class-finder-health';
import { ModalSheet } from './ModalSheet';
import { WhatsAppGlyph } from './WhatsAppGlyph';

interface ClassFinderModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The primary result button: App closes the finder and opens booking or contact in one go. */
  onChoose: (choice: FinderChoice) => void;
}

const TITLE_ID = 'class-finder-title';
const PROGRESS_ID = 'class-finder-progress';
// Steps: the questions, then (only while WhatsApp is on, the one place the details can go) the intro,
// age and height, and one step per free-text field, then the result.
const INTRO_STEP = FINDER_QUESTIONS.length;
const MEASURES_STEP = INTRO_STEP + 1;
const FIRST_TEXT_STEP = MEASURES_STEP + 1;
const OPTIONAL_COUNT = 1 + HEALTH_TEXT_STEPS.length;
const RESULT_STEP = WHATSAPP_ENABLED ? MEASURES_STEP + OPTIONAL_COUNT : FINDER_QUESTIONS.length;
const STEP_FADE = { type: 'spring', bounce: 0, duration: 0.3 } as const;

const ANSWER =
  'press-soft min-h-12 w-full text-left px-4 py-3 rounded-[12px] border text-base leading-[1.4] transition duration-200 ease-spring active:duration-100';
const FIRST_QUESTION_ID = `class-finder-q-${FINDER_QUESTIONS[0].key}`;
// Focused on each new step: no ring on a heading, a quiet underline for keyboard users instead.
const FOCUS_HEADING =
  'focus-visible:outline-none focus-visible:underline focus-visible:decoration-line-strong focus-visible:decoration-1 focus-visible:underline-offset-[6px]';

// 44px hit area without the height: the negative margin hands the extra 24px back to the layout.
const TEXT_BUTTON =
  'inline-flex items-center min-h-11 min-w-11 -my-3 align-middle font-semibold text-ink underline underline-offset-4 decoration-line-strong hover:decoration-ink transition-colors duration-200';

// Typed details stay out of the browser's own memory as far as a page can ask for that: never a
// <form> or a `name`, so nothing can be submitted or autofilled, and no cloud spellcheck.
const PRIVATE_FIELD = { autoComplete: 'off', spellCheck: false } as const;
const STEP_BODY = 'text-base leading-[1.6] text-ink-soft max-w-[46ch] text-pretty';

function progressLabel(step: number) {
  if (step < INTRO_STEP) return `Question ${step + 1} of ${INTRO_STEP}`;
  if (step === INTRO_STEP) return 'Optional';
  return `Optional question ${step - INTRO_STEP} of ${OPTIONAL_COUNT}`;
}

/**
 * "Find your class" (DESIGN_SYSTEM §4): three quick questions, one per step, optional details for
 * Priyanshi, then a suggested class with one honest action. Each tap moves straight on (no timer) and
 * focus follows to the new heading. Steps cross-fade (opacity only); with reduced motion they change at once.
 *
 * `health` is separate from `answers` on purpose: the types keep it out of recommend() and onChoose,
 * so it only ever reaches the preview and the wa.me link. It is cleared on every way out.
 */
export function ClassFinderModal({ isOpen, onClose, onChoose }: ClassFinderModalProps) {
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<FinderAnswers>>({});
  const [health, setHealth] = useState<FinderHealth>(EMPTY_HEALTH);
  const [showAlt, setShowAlt] = useState(false);
  // The step the result was reached from, for its Back.
  const [resultFrom, setResultFrom] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Set by a step change (or Remove) the person made; opening the sheet leaves focus to ModalSheet.
  const focusNextRef = useRef(false);

  // Reset on close (the exit keeps the last frame), so reopening never flashes the previous result.
  useEffect(() => {
    if (isOpen) return;
    setStep(0);
    setAnswers({});
    setHealth(EMPTY_HEALTH);
    setShowAlt(false);
    setResultFrom(0);
    focusNextRef.current = false;
  }, [isOpen]);

  useEffect(() => {
    if (!focusNextRef.current) return;
    focusNextRef.current = false;
    headingRef.current?.focus();
    // `health` for Remove, which changes neither of the others. The ref keeps typing from moving focus.
  }, [step, showAlt, health]);

  const goTo = (next: number) => {
    focusNextRef.current = true;
    if (next === RESULT_STEP) setResultFrom(step);
    setStep(next);
  };

  const answer = (key: keyof FinderAnswers, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setShowAlt(false);
    goTo(step + 1);
  };

  const startAgain = () => {
    setAnswers({});
    setHealth(EMPTY_HEALTH);
    setShowAlt(false);
    goTo(0);
  };

  const patchHealth = (patch: Partial<FinderHealth>) => setHealth((prev) => ({ ...prev, ...patch }));

  const complete =
    answers.goal && answers.experience && answers.format ? (answers as FinderAnswers) : null;
  const onResult = step === RESULT_STEP && complete;

  return (
    <ModalSheet
      isOpen={isOpen}
      onClose={onClose}
      labelledBy={TITLE_ID}
      describedBy={`${PROGRESS_ID} ${FIRST_QUESTION_ID}`}
      closeLabel="Close class finder"
      keyboardAware
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p id={PROGRESS_ID} className={ui.eyebrow}>
            {onResult ? 'Your suggestion' : progressLabel(step)}
          </p>
          {/* On the result the eyebrow leads straight into the class name; the title stays for the dialog's name. */}
          <h2 id={TITLE_ID} className={onResult ? 'sr-only' : ui.title}>
            Find your class
          </h2>
        </div>

        <m.div
          key={step}
          data-testid="class-finder-step"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={STEP_FADE}
        >
          {onResult ? (
            <Result
              answers={complete}
              health={health}
              showAlt={showAlt}
              headingRef={headingRef}
              onSwap={() => {
                focusNextRef.current = true;
                setShowAlt((v) => !v);
              }}
              onChoose={onChoose}
              onStartAgain={startAgain}
              onRemove={() => {
                focusNextRef.current = true;
                setHealth(EMPTY_HEALTH);
              }}
              onBack={() => goTo(resultFrom)}
            />
          ) : step < INTRO_STEP || !WHATSAPP_ENABLED ? (
            <Question
              question={FINDER_QUESTIONS[Math.min(step, INTRO_STEP - 1)]}
              answers={answers}
              headingRef={headingRef}
              onAnswer={answer}
              onBack={step > 0 ? () => goTo(step - 1) : undefined}
            />
          ) : step === INTRO_STEP ? (
            <DetailsIntro
              headingRef={headingRef}
              onAdd={() => goTo(MEASURES_STEP)}
              onSkip={() => {
                setHealth(EMPTY_HEALTH);
                goTo(RESULT_STEP);
              }}
              onBack={() => goTo(step - 1)}
            />
          ) : step === MEASURES_STEP ? (
            <MeasuresStep
              health={health}
              headingRef={headingRef}
              onChange={patchHealth}
              onNext={() => goTo(step + 1)}
              onBack={() => goTo(step - 1)}
            />
          ) : (
            <TextStep
              field={HEALTH_TEXT_STEPS[step - FIRST_TEXT_STEP]}
              value={health[HEALTH_TEXT_STEPS[step - FIRST_TEXT_STEP].key]}
              isLast={step === RESULT_STEP - 1}
              headingRef={headingRef}
              onChange={patchHealth}
              onNext={() => goTo(step + 1)}
              onBack={() => goTo(step - 1)}
            />
          )}
        </m.div>
      </div>
    </ModalSheet>
  );
}

interface QuestionProps {
  question: FinderQuestion;
  answers: Partial<FinderAnswers>;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onAnswer: (key: keyof FinderAnswers, value: string) => void;
  onBack?: () => void;
}

/** One question: its heading (focused when the step arrives) and a group of full-width answers. */
function Question({ question: q, answers, headingRef, onAnswer, onBack }: QuestionProps) {
  const headingId = `class-finder-q-${q.key}`;
  return (
    <div className="flex flex-col gap-4">
      <StepHeading id={headingId} headingRef={headingRef}>
        {q.title}
      </StepHeading>
      <div role="group" aria-labelledby={headingId} className="flex flex-col gap-2">
        {q.options.map((o) => {
          const selected = answers[q.key] === o.value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onAnswer(q.key, o.value)}
              className={cn(
                ANSWER,
                selected ? 'bg-ink border-ink text-on-ink' : 'bg-surface-alt border-transparent hover:border-line-strong text-ink'
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {onBack && <BackButton onBack={onBack} />}
    </div>
  );
}

interface StepHeadingProps {
  id?: string;
  headingRef: RefObject<HTMLHeadingElement | null>;
  children: ReactNode;
}

function StepHeading({ id, headingRef, children }: StepHeadingProps) {
  return (
    <h3
      id={id}
      ref={headingRef}
      tabIndex={-1}
      aria-describedby={PROGRESS_ID}
      className={cn('font-display font-normal text-h4 text-ink', FOCUS_HEADING)}
    >
      {children}
    </h3>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" onClick={onBack} className={cn(TEXT_BUTTON, 'self-start text-sm')}>
      Back
    </button>
  );
}

interface DetailsIntroProps {
  headingRef: RefObject<HTMLHeadingElement | null>;
  onAdd: () => void;
  onSkip: () => void;
  onBack: () => void;
}

/** Says where the details go before anything is typed, and that skipping costs nothing. */
function DetailsIntro({ headingRef, onAdd, onSkip, onBack }: DetailsIntroProps) {
  return (
    <div className="flex flex-col gap-4">
      <StepHeading headingRef={headingRef}>{HEALTH_INTRO.title}</StepHeading>
      <div className="flex flex-col gap-2">
        {HEALTH_INTRO.paragraphs.map((p) => (
          <p key={p} className={STEP_BODY}>
            {p}
          </p>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <button type="button" onClick={onAdd} className={cn(ui.primary, 'w-full')}>
          {HEALTH_INTRO.add}
        </button>
        <button type="button" onClick={onSkip} className={cn(ui.secondary, 'w-full')}>
          {HEALTH_INTRO.skip}
        </button>
      </div>
      <BackButton onBack={onBack} />
    </div>
  );
}

interface StepActionsProps {
  nextLabel: string;
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
}

function StepActions({ nextLabel, onNext, onSkip, onBack }: StepActionsProps) {
  return (
    <>
      <button type="button" onClick={onNext} className={cn(ui.primary, 'w-full')}>
        {nextLabel}
      </button>
      <div className="flex items-center gap-6">
        <BackButton onBack={onBack} />
        <button type="button" onClick={onSkip} className={cn(TEXT_BUTTON, 'text-sm')}>
          Skip
        </button>
      </div>
    </>
  );
}

const AGE_ID = 'class-finder-age';
const HEIGHT_ID = 'class-finder-height';

interface MeasuresStepProps {
  health: FinderHealth;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onChange: (patch: Partial<FinderHealth>) => void;
  onNext: () => void;
  onBack: () => void;
}

/** Age and height, side by side. The guards only catch typos; the numbers never affect the suggestion. */
function MeasuresStep({ health, headingRef, onChange, onNext, onBack }: MeasuresStepProps) {
  const [errors, setErrors] = useState({ age: false, height: false });
  const ageRef = useRef<HTMLInputElement>(null);
  const heightRef = useRef<HTMLInputElement>(null);
  const focusAfterErrorRef = useRef<HTMLInputElement | null>(null);

  // After the commit, so a screen reader announces the field together with its error.
  useEffect(() => {
    focusAfterErrorRef.current?.focus();
    focusAfterErrorRef.current = null;
  }, [errors]);

  const next = () => {
    const age = !ageOk(health.age);
    const height = !heightOk(health.height);
    if (!age && !height) {
      setErrors({ age, height });
      onNext();
      return;
    }
    focusAfterErrorRef.current = age ? ageRef.current : heightRef.current;
    setErrors({ age, height });
  };

  const field = (key: 'age' | 'height', id: string, label: string, ref: RefObject<HTMLInputElement | null>) => (
    <div className="flex flex-col gap-2 min-w-0">
      <label htmlFor={id} className={ui.label}>
        {label}
      </label>
      <input
        id={id}
        ref={ref}
        type="text"
        inputMode="numeric"
        maxLength={3}
        enterKeyHint="next"
        {...PRIVATE_FIELD}
        value={health[key]}
        aria-invalid={errors[key] || undefined}
        aria-describedby={errors[key] ? `${id}-error` : undefined}
        onChange={(e) => {
          setErrors((prev) => ({ ...prev, [key]: false }));
          onChange({ [key]: normaliseDigits(e.target.value) });
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          // Age first, then height: Enter on Age with Height still empty goes there, not on.
          if (key === 'age' && health.height === '') heightRef.current?.focus();
          else next();
        }}
        className={ui.input}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <StepHeading headingRef={headingRef}>{HEALTH_MEASURES.title}</StepHeading>
      <div className="grid grid-cols-2 gap-3">
        {field('age', AGE_ID, HEALTH_MEASURES.ageLabel, ageRef)}
        {field('height', HEIGHT_ID, HEALTH_MEASURES.heightLabel, heightRef)}
      </div>
      {errors.age && (
        <p id={`${AGE_ID}-error`} role="alert" className="text-sm leading-[1.5] text-error">
          {HEALTH_MEASURES.ageError}
        </p>
      )}
      {errors.height && (
        <p id={`${HEIGHT_ID}-error`} role="alert" className="text-sm leading-[1.5] text-error">
          {HEALTH_MEASURES.heightError}
        </p>
      )}
      <StepActions
        nextLabel="Next"
        onNext={next}
        onSkip={() => {
          onChange({ age: '', height: '' });
          onNext();
        }}
        onBack={onBack}
      />
    </div>
  );
}

interface TextStepProps {
  field: { key: HealthTextKey; title: string; hint: string };
  value: string;
  isLast: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onChange: (patch: Partial<FinderHealth>) => void;
  onNext: () => void;
  onBack: () => void;
}

function TextStep({ field, value, isLast, headingRef, onChange, onNext, onBack }: TextStepProps) {
  const headingId = `class-finder-q-${field.key}`;
  const hintId = `${headingId}-hint`;
  return (
    <div className="flex flex-col gap-4">
      <StepHeading id={headingId} headingRef={headingRef}>
        {field.title}
      </StepHeading>
      <div className="flex flex-col gap-2">
        <p id={hintId} className="text-sm leading-[1.5] text-ink-soft">
          {field.hint}
        </p>
        <textarea
          rows={3}
          maxLength={HEALTH_MAX_CHARS}
          dir="auto"
          {...PRIVATE_FIELD}
          value={value}
          aria-labelledby={headingId}
          aria-describedby={hintId}
          onChange={(e) => onChange({ [field.key]: e.target.value })}
          className={cn(ui.textarea, 'block resize-none')}
        />
      </div>
      <StepActions
        nextLabel={isLast ? 'See my suggestion' : 'Next'}
        onNext={onNext}
        onSkip={() => {
          onChange({ [field.key]: '' });
          onNext();
        }}
        onBack={onBack}
      />
    </div>
  );
}

interface ResultProps {
  answers: FinderAnswers;
  health: FinderHealth;
  showAlt: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onSwap: () => void;
  onChoose: (choice: FinderChoice) => void;
  onStartAgain: () => void;
  onRemove: () => void;
  onBack: () => void;
}

function Result({ answers, health, showAlt, headingRef, onSwap, onChoose, onStartAgain, onRemove, onBack }: ResultProps) {
  const { main, alt } = recommend(answers);
  const shown = showAlt && alt ? alt : main;
  const other = showAlt && alt ? main : alt;
  const cls = finderClass(shown);
  const { label, choice } = resultAction(shown, answers.format);
  const { formatNote, extra, notices } = resultLines(shown, answers);
  // The card's duration only ("60 min").
  const duration = cls.line.split(' · ').pop();
  // One string for the preview and the link, rebuilt when "Also a good fit" changes the class.
  const { message, trimmed } = classFinderMessage(classFinderPrefill(answers, shown), health, whatsappUrl);
  const hasDetails = WHATSAPP_ENABLED && finderHasHealth(health);
  const whatsAppLink = (text: string, className: string) => (
    <a href={whatsappUrl(message)} target="_blank" rel="noopener noreferrer" className={cn(ui.secondary, 'w-full', className)}>
      <WhatsAppGlyph size={16} />
      {text}
    </a>
  );

  return (
    <div data-testid="class-finder-result" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h3
          ref={headingRef}
          tabIndex={-1}
          aria-describedby={PROGRESS_ID}
          className={cn('font-display font-normal text-title text-ink', FOCUS_HEADING)}
        >
          {shown}
        </h3>
        <p className="text-base leading-[1.6] text-ink-soft max-w-[46ch] text-pretty">{FINDER_REASONS[shown]}</p>
        {duration && <p className="text-sm leading-[1.5] text-ink-soft">{duration}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-sm leading-[1.5] text-ink-soft">{formatNote}</p>
        {extra && <p className="text-sm leading-[1.5] text-ink">{extra}</p>}
      </div>

      {notices.map((n) => (
        <p key={n} data-testid="class-finder-notice" className={ui.notice}>
          {n}
        </p>
      ))}
      {/* One notice at a time: the goal's already asks them to tell Priyanshi. */}
      {hasDetails && notices.length === 0 && finderHasHealthNotes(health) && (
        <p data-testid="class-finder-health-notice" className={ui.notice}>
          {HEALTH_RESULT.notice}
        </p>
      )}

      {other && (
        <p className="text-sm leading-[1.5] text-ink-soft">
          Also a good fit:{' '}
          <button type="button" onClick={onSwap} aria-label={`Show ${other} instead`} className={TEXT_BUTTON}>
            {other}
          </button>
        </p>
      )}

      <div className="flex flex-col gap-3">
        {hasDetails && (
          <p data-testid="class-finder-action-note" className="text-sm leading-[1.5] text-ink-soft">
            {choice.kind === 'booking' ? HEALTH_RESULT.bookingNote : HEALTH_RESULT.contactNote}
          </p>
        )}
        <button type="button" onClick={() => onChoose(choice)} className={cn(ui.primary, 'w-full')}>
          {label}
        </button>
        {WHATSAPP_ENABLED && !hasDetails && whatsAppLink('Ask Priyanshi on WhatsApp', '')}
      </div>

      {/* After the main action, so a long message never pushes it off screen. The button sits directly under the message it sends. */}
      {hasDetails && (
        <div data-testid="class-finder-details" className={cn(ui.panel, 'flex flex-col gap-3')}>
          <p className={ui.eyebrow}>{HEALTH_RESULT.panelTitle}</p>
          <p className="text-sm leading-[1.5] text-ink-soft">{HEALTH_RESULT.privacy}</p>
          {trimmed && <p className="text-sm leading-[1.5] text-ink">{HEALTH_RESULT.trimmed}</p>}
          {/* translate="no": page translation would send this text to a cloud service, and make it differ from the link. */}
          <p
            data-testid="class-finder-preview"
            dir="auto"
            translate="no"
            className="text-sm leading-[1.5] text-ink whitespace-pre-wrap break-words"
          >
            {message}
          </p>
          {whatsAppLink(HEALTH_RESULT.send, 'border-line-strong')}
          <button type="button" onClick={onRemove} className={cn(TEXT_BUTTON, 'self-start text-sm my-0')}>
            {HEALTH_RESULT.remove}
          </button>
        </div>
      )}

      <div className="flex items-center gap-6">
        <button type="button" onClick={onStartAgain} className={cn(TEXT_BUTTON, 'text-sm')}>
          Start again
        </button>
        <button type="button" onClick={onBack} className={cn(TEXT_BUTTON, 'text-sm')}>
          Back
        </button>
      </div>
    </div>
  );
}
