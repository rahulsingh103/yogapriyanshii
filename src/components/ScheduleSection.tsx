import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ClassSession } from '../types';
import { Calendar, Clock, MapPin, Users, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';

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
    <section id="schedule" className="py-24 bg-[#faf8f3] border-b border-[#0f0e0b]/8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.25em] text-[#c4b48a] font-semibold mb-3">
              04. Live Timetable
            </p>
            <h2 className="font-serif text-3xl sm:text-5xl text-[#0f0e0b] tracking-tight mb-4">
              Weekly schedule
            </h2>
            <p className="text-base text-[#0f0e0b]/70 leading-relaxed">
              Real-time availability for the next 8 weeks in Dubai Time (GMT+4). 
              Capacities are strictly limited to ensure individual attention and space.
            </p>
          </div>

          {/* Week Selector / Refresh */}
          <div className="flex items-center gap-3">
            <div className="inline-flex p-1 bg-[#f2ede4] border border-[#0f0e0b]/10 rounded-md text-xs">
              <button
                type="button"
                onClick={() => setFilterWeek(0)}
                className={`px-3 py-1.5 font-medium rounded transition-colors ${
                  filterWeek === 0 ? 'bg-[#0f0e0b] text-[#faf8f3]' : 'text-[#0f0e0b]/70 hover:text-[#0f0e0b]'
                }`}
              >
                This Week
              </button>
              <button
                type="button"
                onClick={() => setFilterWeek(1)}
                className={`px-3 py-1.5 font-medium rounded transition-colors ${
                  filterWeek === 1 ? 'bg-[#0f0e0b] text-[#faf8f3]' : 'text-[#0f0e0b]/70 hover:text-[#0f0e0b]'
                }`}
              >
                Next Week
              </button>
              <button
                type="button"
                onClick={() => setFilterWeek(2)}
                className={`px-3 py-1.5 font-medium rounded transition-colors ${
                  filterWeek === 2 ? 'bg-[#0f0e0b] text-[#faf8f3]' : 'text-[#0f0e0b]/70 hover:text-[#0f0e0b]'
                }`}
              >
                Week 3
              </button>
            </div>

            <button
              type="button"
              onClick={loadSchedule}
              className="p-2 border border-[#0f0e0b]/10 text-[#0f0e0b]/70 hover:text-[#0f0e0b] transition-colors rounded-md"
              title="Refresh availability"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Loading / Error States */}
        {loading && (
          <div className="py-20 text-center bg-[#f2ede4] border border-[#0f0e0b]/8">
            <RefreshCw className="w-8 h-8 mx-auto text-[#c4b48a] animate-spin mb-4" />
            <p className="text-sm font-medium text-[#0f0e0b]/70">Retrieving live studio availability...</p>
          </div>
        )}

        {error && (
          <div className="p-8 bg-[#f2ede4] border border-red-300 text-center mb-12">
            <AlertCircle className="w-8 h-8 mx-auto text-amber-700 mb-3" />
            <p className="text-sm text-red-900 mb-4">{error}</p>
            <button
              type="button"
              onClick={loadSchedule}
              className="px-4 py-2 bg-[#0f0e0b] text-[#faf8f3] text-xs font-semibold uppercase tracking-wider"
            >
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Weekdays Stack / Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 mb-10">
              {currentWeekSessions.map((session) => {
                const isSelected = selectedSessionId === session.id;
                const isFull = session.status === 'full';
                const isPast = session.status === 'past';

                if (session.isRestDay) {
                  return (
                    <div
                      key={session.id}
                      className="bg-[#f2ede4]/50 border border-dashed border-[#0f0e0b]/10 p-5 flex flex-col justify-between opacity-60"
                    >
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-[#0f0e0b]/50 mb-1">
                          Friday
                        </p>
                        <p className="text-[11px] text-[#0f0e0b]/40 mb-4 font-mono">
                          {session.dateDubai.split(', ')[1]}
                        </p>
                        <h4 className="font-serif text-lg text-[#0f0e0b]/60 mb-2">Rest Day</h4>
                        <p className="text-xs text-[#0f0e0b]/50">No scheduled classes</p>
                      </div>
                      <div className="pt-6">
                        <span className="text-[11px] text-[#0f0e0b]/40 font-mono">—</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={session.id}
                    onClick={() => setSelectedSessionId(session.id)}
                    className={`cursor-pointer p-5 border flex flex-col justify-between transition-all ${
                      isSelected
                        ? 'bg-[#0f0e0b] text-[#faf8f3] border-[#0f0e0b] shadow-md scale-[1.02]'
                        : isFull
                        ? 'bg-[#f2ede4]/70 border-[#0f0e0b]/10 opacity-70'
                        : 'bg-[#f2ede4] border-[#0f0e0b]/10 hover:border-[#c4b48a]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span
                          className={`font-semibold uppercase tracking-wider text-[11px] ${
                            isSelected ? 'text-[#c4b48a]' : 'text-[#0f0e0b]/60'
                          }`}
                        >
                          {session.dateDubai.split(',')[0]}
                        </span>
                        <span className={`text-[11px] font-mono ${isSelected ? 'text-[#faf8f3]/60' : 'text-[#0f0e0b]/50'}`}>
                          {session.timeDubai}
                        </span>
                      </div>

                      <p className={`text-[11px] font-mono mb-3 ${isSelected ? 'text-[#faf8f3]/50' : 'text-[#0f0e0b]/40'}`}>
                        {session.dateDubai.split(', ')[1]}
                      </p>

                      <h4 className="font-serif text-base font-medium mb-1">
                        {session.className}
                      </h4>

                      <p className={`text-xs mb-4 ${isSelected ? 'text-[#faf8f3]/70' : 'text-[#0f0e0b]/60'}`}>
                        {session.level} · {session.duration}m
                      </p>
                    </div>

                    <div className="pt-4 border-t border-current/10 flex items-center justify-between">
                      {isPast ? (
                        <span className="text-xs font-mono opacity-50">Session Past</span>
                      ) : isFull ? (
                        <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">
                          Fully Booked
                        </span>
                      ) : (
                        <span
                          className={`text-xs font-semibold tabular-nums ${
                            isSelected ? 'text-[#c4b48a]' : 'text-[#0f0e0b]'
                          }`}
                        >
                          {session.spotsLeft} spots left
                        </span>
                      )}

                      <span className={`text-xs font-semibold uppercase tracking-wider ${isSelected ? 'text-[#c4b48a]' : 'text-[#0f0e0b]/40'}`}>
                        {isSelected ? 'Selected' : 'View'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Session Detail Card */}
            {activeSelected && !activeSelected.isRestDay && (
              <div className="bg-[#f2ede4] border border-[#0f0e0b]/10 p-8 sm:p-10 mb-16 flex flex-col lg:flex-row lg:items-center justify-between gap-8 shadow-xs">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-3 text-xs text-[#0f0e0b]/60 mb-2">
                    <span className="text-[#c4b48a] font-semibold uppercase tracking-wider">
                      Selected Session
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{activeSelected.dateDubai}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{activeSelected.timeDubai} (Dubai Time)</span>
                  </div>

                  <h3 className="font-serif text-2xl sm:text-4xl text-[#0f0e0b] mb-3">
                    {activeSelected.className}
                  </h3>

                  <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-[#0f0e0b]/75 mb-4">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-[#c4b48a]" />
                      {activeSelected.duration} Minutes
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-[#c4b48a]" />
                      Capacity: {activeSelected.capacity} students (
                      <span className="font-semibold tabular-nums text-[#0f0e0b]">
                        {activeSelected.spotsLeft} available
                      </span>
                      )
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-[#c4b48a]" />
                      BurJuman Residence Block D & Online
                    </span>
                  </div>

                  <p className="text-sm text-[#0f0e0b]/70 leading-relaxed">
                    Mats, blocks, and straps provided for in-person attendees. Interactive Zoom link dispatched 1 hour prior to start for online bookings.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                  {activeSelected.status === 'full' ? (
                    <button
                      disabled
                      type="button"
                      className="px-8 py-4 bg-[#0f0e0b]/20 text-[#0f0e0b]/50 text-xs font-semibold uppercase tracking-widest cursor-not-allowed text-center"
                    >
                      Class is Full
                    </button>
                  ) : activeSelected.status === 'past' ? (
                    <button
                      disabled
                      type="button"
                      className="px-8 py-4 bg-[#0f0e0b]/20 text-[#0f0e0b]/50 text-xs font-semibold uppercase tracking-widest cursor-not-allowed text-center"
                    >
                      Session Already Passed
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelectSession(activeSelected)}
                      className="px-8 py-4 bg-[#c4b48a] hover:bg-[#b3a277] text-[#0f0e0b] text-xs font-semibold uppercase tracking-[0.2em] transition-colors text-center shadow-xs"
                    >
                      Book This Class ({activeSelected.spotsLeft} Left)
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* "Good to know" Policy Box per PRD §5 */}
            <div className="bg-[#0f0e0b] text-[#faf8f3] p-8 sm:p-10 border border-[#faf8f3]/10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h4 className="font-serif text-xl sm:text-2xl text-[#faf8f3] mb-2">
                    Good to know
                  </h4>
                  <p className="text-xs sm:text-sm text-[#faf8f3]/80 leading-relaxed max-w-3xl">
                    <strong>Cancellation Policy:</strong> Cancellations are <strong>free up to 6 hours</strong> before class. 
                    Late cancellations use one class credit. First class is always free.
                  </p>
                  <p className="text-xs text-[#c4b48a] mt-2">
                    Studio Hours: Mon–Sun 6:30 AM – 8:00 PM · BurJuman Residence Block D, Dubai
                  </p>
                </div>

                <div className="shrink-0">
                  <button
                    type="button"
                    onClick={onOpenCancel}
                    className="px-6 py-3 border border-[#faf8f3]/30 hover:border-[#c4b48a] text-[#faf8f3] hover:text-[#c4b48a] text-xs uppercase tracking-widest transition-colors"
                  >
                    Cancel / Manage Reservation
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
};
