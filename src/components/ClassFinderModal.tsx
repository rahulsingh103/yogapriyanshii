import { useEffect, useRef, useState, type RefObject } from 'react';
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
const RESULT_STEP = FINDER_QUESTIONS.length;
const STEP_FADE = { type: 'spring', bounce: 0, duration: 0.3 } as const;

const ANSWER =
  'press-soft min-h-12 w-full text-left px-4 py-3 rounded-[12px] border text-base leading-[1.4] transition duration-200 ease-spring active:duration-100';
const FIRST_QUESTION_ID = `class-finder-q-${FINDER_QUESTIONS[0].key}`;
// Focused on each new step: no ring on a heading, a quiet underline for keyboard users instead.
const FOCUS_HEADING =
  'focus-visible:outline-none focus-visible:underline focus-visible:decoration-line-strong focus-visible:decoration-1 focus-visible:underline-offset-[6px]';

// 44px hit area without the height: the negative margin hands the extra 24px back to the layout.
const TEXT_BUTTON =
  'inline-flex items-center min-h-11 -my-3 align-middle font-semibold text-ink underline underline-offset-4 decoration-line hover:decoration-ink transition-colors duration-200';

/**
 * "Find your class" (DESIGN_SYSTEM §4): three quick questions, one per step, then a suggested class
 * with one honest action. Each tap moves straight on (no timer) and focus follows to the new heading.
 * Steps cross-fade (opacity only); with reduced motion they change at once.
 */
export function ClassFinderModal({ isOpen, onClose, onChoose }: ClassFinderModalProps) {
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<FinderAnswers>>({});
  const [showAlt, setShowAlt] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Set by a step change the person made; opening the sheet leaves focus to ModalSheet.
  const focusNextRef = useRef(false);

  // Reset on close (the exit keeps the last frame), so reopening never flashes the previous result.
  useEffect(() => {
    if (isOpen) return;
    setStep(0);
    setAnswers({});
    setShowAlt(false);
    focusNextRef.current = false;
  }, [isOpen]);

  useEffect(() => {
    if (!focusNextRef.current) return;
    focusNextRef.current = false;
    headingRef.current?.focus();
  }, [step, showAlt]);

  const goTo = (next: number) => {
    focusNextRef.current = true;
    setStep(next);
  };

  const answer = (key: keyof FinderAnswers, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setShowAlt(false);
    goTo(step + 1);
  };

  const startAgain = () => {
    setAnswers({});
    setShowAlt(false);
    goTo(0);
  };

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
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p id={PROGRESS_ID} className={ui.eyebrow}>
            {onResult ? 'Your suggestion' : `Question ${step + 1} of ${RESULT_STEP}`}
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
              showAlt={showAlt}
              headingRef={headingRef}
              onSwap={() => {
                focusNextRef.current = true;
                setShowAlt((v) => !v);
              }}
              onChoose={onChoose}
              onStartAgain={startAgain}
            />
          ) : (
            <Question
              question={FINDER_QUESTIONS[Math.min(step, RESULT_STEP - 1)]}
              answers={answers}
              headingRef={headingRef}
              onAnswer={answer}
              onBack={step > 0 ? () => goTo(step - 1) : undefined}
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
      <h3
        id={headingId}
        ref={headingRef}
        tabIndex={-1}
        aria-describedby={PROGRESS_ID}
        className={cn('font-display font-normal text-h4 text-ink', FOCUS_HEADING)}
      >
        {q.title}
      </h3>
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
      {onBack && (
        <button type="button" onClick={onBack} className={cn(TEXT_BUTTON, 'self-start text-sm')}>
          Back
        </button>
      )}
    </div>
  );
}

interface ResultProps {
  answers: FinderAnswers;
  showAlt: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onSwap: () => void;
  onChoose: (choice: FinderChoice) => void;
  onStartAgain: () => void;
}

function Result({ answers, showAlt, headingRef, onSwap, onChoose, onStartAgain }: ResultProps) {
  const { main, alt } = recommend(answers);
  const shown = showAlt && alt ? alt : main;
  const other = showAlt && alt ? main : alt;
  const cls = finderClass(shown);
  const { label, choice } = resultAction(shown, answers.format);
  const { formatNote, extra, notices } = resultLines(shown, answers);
  // The card's duration only ("60 min"); Aerial's line has none.
  const duration = shown === 'Aerial Yoga' ? null : cls.line.split(' · ').pop();

  return (
    <div data-testid="class-finder-result" className="flex flex-col gap-5">
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

      {other && (
        <p className="text-sm leading-[1.5] text-ink-soft">
          Also a good fit:{' '}
          <button type="button" onClick={onSwap} aria-label={`Show ${other} instead`} className={TEXT_BUTTON}>
            {other}
          </button>
        </p>
      )}

      <div className="flex flex-col gap-3">
        <button type="button" onClick={() => onChoose(choice)} className={cn(ui.primary, 'w-full')}>
          {label}
        </button>
        {WHATSAPP_ENABLED && (
          <a
            href={whatsappUrl(classFinderPrefill(answers, shown))}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(ui.secondary, 'w-full')}
          >
            <WhatsAppGlyph size={16} />
            Ask Priyanshi on WhatsApp
          </a>
        )}
      </div>

      <button type="button" onClick={onStartAgain} className={cn(TEXT_BUTTON, 'self-start text-sm')}>
        Start again
      </button>
    </div>
  );
}
