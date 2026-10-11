import React, { useState, useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { AnimateIcon } from '@/components/animate-ui/icons/icon';
import { ArrowRight } from '@/components/animate-ui/icons/arrow-right';
import { cn } from '@/lib/utils';
import { ui } from '@/lib/ui';
import { api } from '../services/api';
import { ClassSession } from '../types';
import { Reveal } from './Reveal';

interface ScheduleSectionProps {
  onSelectSession: (session: ClassSession) => void;
  onOpenCancel: () => void;
}

export const ScheduleSection: React.FC<ScheduleSectionProps> = ({
  onSelectSession,
  onOpenCancel,
}) => {
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [filterWeek, setFilterWeek] = useState<number>(0); // 0 = current week, 1 = next week, etc.

  const loadSchedule = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getSchedule();
      setSessions(data);
      if (data.length > 0 && !selectedSessionId) {
        const firstAvailable = data.find((s) => !s.isRestDay && s.status !== 'past');
        if (firstAvailable) {
          setSelectedSessionId(firstAvailable.id);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Unable to load live schedule.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedule();
  }, []);

  // Filter sessions for the selected week (7 days block)
  const nonRestSessions = sessions.filter((s) => !s.isRestDay);
  const weekOffset = filterWeek * 7;
  const currentWeekSessions = sessions.slice(weekOffset, weekOffset + 7);

  const activeSelected = sessions.find((s) => s.id === selectedSessionId) || nonRestSessions[0];

  return (
    <section id="schedule" className="py-20 lg:py-32">
      <Reveal className="max-w-[1040px] mx-auto px-5 flex flex-col gap-6">
        {/* Heading, one line, and the week switcher */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex flex-col gap-4">
            <h2 className="font-display font-normal text-[clamp(34px,5.5vw,58px)] leading-[1.05] text-ink">
              Weekly schedule
            </h2>
            <p className="text-base leading-[1.6] text-ink-soft max-w-[46ch]">
              Live availability in Dubai time (GMT+4). Small classes, so every student gets attention.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="flex-1 md:flex-none grid grid-cols-3 gap-1 p-1 rounded-full bg-surface-alt">
              {(
                [
                  [0, 'This Week'],
                  [1, 'Next Week'],
                  [2, 'Week 3'],
                ] as const
              ).map(([week, label]) => (
                <button
                  key={week}
                  type="button"
                  aria-pressed={filterWeek === week}
                  onClick={() => setFilterWeek(week)}
                  className={cn(
                    'min-h-11 px-2 sm:px-4 rounded-full text-sm font-medium whitespace-nowrap transition-colors duration-200',
                    filterWeek === week ? 'bg-ink text-on-ink' : 'text-ink-soft hover:text-ink'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={loadSchedule}
              className="inline-flex items-center justify-center size-11 shrink-0 rounded-full border border-line text-ink hover:border-ink transition-colors duration-200"
              title="Refresh availability"
              aria-label="Refresh availability"
            >
              <RefreshCw className={cn('size-4', loading && 'animate-spin motion-reduce:animate-none')} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Loading / error states */}
        {loading && (
          <div className="py-20 flex flex-col items-center gap-4 text-center rounded-[18px] bg-glass backdrop-blur-[8px]">
            <RefreshCw className="size-6 text-accent-text animate-spin motion-reduce:animate-none" aria-hidden="true" />
            <p className="text-sm text-ink-soft">Retrieving live studio availability...</p>
          </div>
        )}

        {error && (
          <div role="alert" className="py-12 px-6 flex flex-col items-center gap-4 text-center rounded-[18px] bg-error-bg">
            <AlertCircle className="size-6 text-error" aria-hidden="true" />
            <p className="text-sm text-error">{error}</p>
            <button type="button" onClick={loadSchedule} className={ui.primary}>
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* The week: one card per day */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3">
              {currentWeekSessions.map((session) => {
                const isSelected = selectedSessionId === session.id;
                const isFull = session.status === 'full';
                const isPast = session.status === 'past';

                if (session.isRestDay) {
                  return (
                    <div
                      key={session.id}
                      className="min-h-[176px] p-4 rounded-[16px] border border-dashed border-line flex flex-col gap-1"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">Friday</p>
                      <p className="text-xs text-ink-soft">{session.dateDubai.split(', ')[1]}</p>
                      <p className="mt-auto font-display text-[24px] leading-[1.1] text-ink-soft">Rest Day</p>
                      <p className="text-xs text-ink-soft">No scheduled classes</p>
                    </div>
                  );
                }

                return (
                  <button
                    key={session.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedSessionId(session.id)}
                    className={cn(
                      'min-h-[176px] p-4 rounded-[16px] border text-left flex flex-col gap-1 transition-colors duration-200',
                      isSelected
                        ? 'bg-ink border-ink text-on-ink'
                        : 'bg-glass backdrop-blur-[8px] border-transparent text-ink hover:border-line-strong',
                      (isFull || isPast) && !isSelected && 'opacity-60'
                    )}
                  >
                    <span
                      className={cn('text-xs font-semibold uppercase tracking-[0.14em]', isSelected ? 'text-on-ink' : 'text-ink-soft')}
                    >
                      {session.dateDubai.split(',')[0]}
                    </span>
                    <span className={cn('text-xs tabular-nums', isSelected ? 'text-on-ink/75' : 'text-ink-soft')}>
                      {session.dateDubai.split(', ')[1]} · {session.timeDubai}
                    </span>

                    <span className="mt-auto pt-3 font-display text-[24px] leading-[1.1]">{session.className}</span>
                    <span className={cn('text-xs', isSelected ? 'text-on-ink/75' : 'text-ink-soft')}>
                      {session.level} · {session.duration}m
                    </span>

                    <span className="pt-2 text-xs font-semibold tabular-nums">
                      {isPast ? (
                        <span className={isSelected ? 'text-on-ink/75' : 'text-ink-soft'}>Session Past</span>
                      ) : isFull ? (
                        <span className={cn('uppercase tracking-[0.1em]', isSelected ? 'text-on-ink' : 'text-error')}>
                          Fully Booked
                        </span>
                      ) : (
                        <span className={isSelected ? 'text-on-ink' : 'text-accent-text'}>
                          {session.spotsLeft} spots left
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* The selected session */}
            {activeSelected && !activeSelected.isRestDay && (
              <div
                className="p-6 sm:p-8 rounded-[18px] bg-glass backdrop-blur-[8px] flex flex-col lg:flex-row lg:items-center justify-between gap-6"
              >
                <div className="flex flex-col gap-3 max-w-[560px]">
                  <p className={cn(ui.eyebrow, 'flex flex-wrap items-center gap-x-2 gap-y-1')}>
                    <span className="text-accent-text">Selected Session</span>
                    <span aria-hidden="true">·</span>
                    <span>{activeSelected.dateDubai}</span>
                    <span aria-hidden="true">·</span>
                    <span>{activeSelected.timeDubai} (Dubai Time)</span>
                  </p>

                  <h3 className="font-display font-normal text-[34px] sm:text-[40px] leading-[1.05] text-ink">
                    {activeSelected.className}
                  </h3>

                  <p className="text-sm leading-[1.5] text-ink-soft">
                    {activeSelected.duration} Minutes · Capacity: {activeSelected.capacity} students (
                    <span className="font-semibold tabular-nums text-ink">{activeSelected.spotsLeft} available</span>) ·
                    BurJuman Residence Block D & Online
                  </p>

                  <p className="text-sm leading-[1.5] text-ink-soft">
                    Mats, blocks, and straps provided for in-person attendees. Interactive Zoom link dispatched 1 hour prior to start for online bookings.
                  </p>
                </div>

                <div className="shrink-0">
                  {activeSelected.status === 'full' ? (
                    <button disabled type="button" className={cn(ui.primary, 'w-full lg:w-auto')}>
                      Class is Full
                    </button>
                  ) : activeSelected.status === 'past' ? (
                    <button disabled type="button" className={cn(ui.primary, 'w-full lg:w-auto')}>
                      Session Already Passed
                    </button>
                  ) : (
                    <AnimateIcon animateOnHover asChild>
                      <button
                        type="button"
                        onClick={() => onSelectSession(activeSelected)}
                        className={cn(ui.primary, 'w-full lg:w-auto whitespace-nowrap')}
                      >
                        Book This Class ({activeSelected.spotsLeft} Left)
                        <ArrowRight size={16} aria-hidden="true" />
                      </button>
                    </AnimateIcon>
                  )}
                </div>
              </div>
            )}

            {/* Good to know: one line and the manage button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
              <p className="text-sm leading-[1.5] text-ink-soft">
                Plans changed? Cancel free up to 6 hours before class.
              </p>
              <button type="button" onClick={onOpenCancel} className={cn(ui.secondary, 'self-start sm:self-auto')}>
                Cancel / Manage Reservation
              </button>
            </div>
          </>
        )}
      </Reveal>
    </section>
  );
};
